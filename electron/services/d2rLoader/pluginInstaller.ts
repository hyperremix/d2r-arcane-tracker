import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { D2RLOADER_PLUGIN_FILE_NAME } from '../../app/paths';
import type { D2RLoaderInstallation, D2RLoaderInstallResult } from '../../types/d2rLoader';
import { createServiceLogger } from '../../utils/serviceLogger';

const log = createServiceLogger('D2RLoaderPluginInstaller');

/** Id of the plugin; D2RLoader names its config file after it. */
export const PLUGIN_ID = 'arcane-tracker';

/** The executable D2RLoader users start instead of the game. */
const LOADER_EXECUTABLE = 'D2RLoader.exe';

/** Port and token the plugin needs to reach the app. */
export interface PluginConnectionSettings {
  port: number;
  token: string;
}

/** A file to write: the content, or a file to copy it from. */
interface PlannedWrite {
  target: string;
  source?: string;
  content?: string;
}

/** Changes to the D2R folder, which may need administrator rights. */
interface FileChanges {
  writes: PlannedWrite[];
  removals: string[];
}

/** Runs a PowerShell script with administrator rights; resolves to whether it ran successfully. */
export type RunElevated = (script: string) => Promise<boolean>;

/** Dependencies of the {@link PluginInstaller}. */
export interface PluginInstallerDependencies {
  /** The D2R folder from the settings. */
  getGameFolder: () => string | undefined;
  /** The plugin DLL this build ships; the file may not exist. */
  bundledPluginPath: string;
  /** Port and token to write into the plugin's config file. */
  getConnectionSettings: () => PluginConnectionSettings;
  /** Writes with administrator rights when the D2R folder isn't writable; tests replace it. */
  runElevated?: RunElevated;
  /** Platform override for tests; administrator rights are only asked for on Windows. */
  platform?: NodeJS.Platform;
}

/** Location of the plugin's files in a D2R folder. */
function getPluginPaths(gameFolder: string) {
  const loaderFolder = path.join(gameFolder, 'd2rloader');
  return {
    loader: path.join(gameFolder, LOADER_EXECUTABLE),
    dll: path.join(loaderFolder, 'plugins', D2RLOADER_PLUGIN_FILE_NAME),
    config: path.join(loaderFolder, 'config', `${PLUGIN_ID}.toml`),
  };
}

async function readOptionalFile(filePath: string): Promise<Buffer | undefined> {
  try {
    return await readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Matches `key = value` in a TOML line, keeping the indentation and anything after the value. */
function keyPattern(key: string): RegExp {
  return new RegExp(`^(\\s*${key}\\s*=\\s*)([^#\\r\\n]*?)(\\s*(?:#.*)?)$`);
}

/** Matches a TOML table header and captures the table name. */
const TABLE_HEADER_PATTERN = /^\s*\[([^\]]+)\]/;

/**
 * Finds the plugin's table in the lines of its config file.
 * @returns The index of its header line (-1 when there is none) and the indexes of its lines
 */
function locatePluginTable(lines: string[]): { header: number; body: number[] } {
  let header = -1;
  const body: number[] = [];
  let inTable = false;
  lines.forEach((line, index) => {
    const table = TABLE_HEADER_PATTERN.exec(line);
    if (table) {
      inTable = table[1].trim() === PLUGIN_ID;
      if (inTable && header < 0) header = index;
    } else if (inTable) {
      body.push(index);
    }
  });
  return { header, body };
}

/**
 * Reads `port` and `token` from the plugin's table of its config file.
 * @param toml - The config file
 */
export function readPluginConfig(toml: string): Partial<PluginConnectionSettings> {
  const lines = toml.split(/\r?\n/);
  const values: Partial<PluginConnectionSettings> = {};
  for (const index of locatePluginTable(lines).body) {
    const port = keyPattern('port').exec(lines[index]);
    if (port && /^\d+$/.test(port[2])) values.port = Number(port[2]);
    const token = keyPattern('token').exec(lines[index]);
    if (token && /^"[^"]*"$/.test(token[2])) values.token = token[2].slice(1, -1);
  }
  return values;
}

/**
 * Sets `port` and `token` in the plugin's table of its config file, keeping every other line, so
 * settings the user changed there survive. Keys that are missing are added after the table header;
 * a missing table is added at the end. The plugin uses its defaults for keys that aren't in the file.
 * @param toml - The config file, or undefined when there is none yet
 * @param settings - Port and token of the app
 * @returns The new config file
 */
export function writePluginConfig(
  toml: string | undefined,
  { port, token }: PluginConnectionSettings,
): string {
  const values: Record<keyof PluginConnectionSettings, string> = {
    port: String(port),
    token: `"${token}"`,
  };
  const newline = toml?.includes('\r\n') ? '\r\n' : '\n';
  const lines = toml ? toml.split(/\r?\n/) : [];
  const missing = new Set(Object.keys(values) as (keyof PluginConnectionSettings)[]);
  const table = locatePluginTable(lines);

  for (const index of table.body) {
    for (const key of missing) {
      const match = keyPattern(key).exec(lines[index]);
      if (match) {
        lines[index] = `${match[1]}${values[key]}${match[3]}`;
        missing.delete(key);
      }
    }
  }

  const added = [...missing].map((key) => `${key} = ${values[key]}`);
  if (table.header >= 0) {
    lines.splice(table.header + 1, 0, ...added);
  } else {
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push(`[${PLUGIN_ID}]`, ...added);
  }
  const content = lines.join(newline);
  return content.endsWith(newline) ? content : `${content}${newline}`;
}

/** Stays clear of the 32,767 characters a Windows process may have in its command line. */
const MAX_ELEVATION_COMMAND_LENGTH = 30_000;

/**
 * Quotes a value for a single-quoted PowerShell string. PowerShell treats the typographic single
 * quotes (U+2018 to U+201B) like the ASCII one, so a path with one of them (a user name like
 * O’Brien) would end the string early; each is doubled.
 */
export function quotePowerShell(value: string): string {
  return `'${value.replace(/['\u2018\u2019\u201A\u201B]/g, (quote) => quote + quote)}'`;
}

/**
 * Builds the command that runs a script in an elevated PowerShell. The script travels in the
 * command line as `-EncodedCommand` (base64 of UTF-16LE), so there is no script file that another
 * process could replace while the administrator prompt is open. The command line of a Windows
 * process is limited to 32,767 characters and the script carries the config files it writes
 * (base64 inside base64 of UTF-16LE), so `applyElevated` checks the length of the command.
 */
export function buildElevationCommand(script: string): string {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return [
    '$process = Start-Process -FilePath powershell.exe -Verb RunAs -Wait -PassThru -WindowStyle Hidden',
    `-ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${encoded}';`,
    'exit $process.ExitCode',
  ].join(' ');
}

/**
 * Runs a PowerShell script in an elevated PowerShell (Windows shows the administrator prompt) and
 * waits for it. Declining the prompt fails the outer PowerShell, which resolves to false.
 */
const runElevatedPowerShell: RunElevated = (script) =>
  new Promise<boolean>((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', buildElevationCommand(script)],
      { windowsHide: true },
      (error) => resolve(!error),
    );
  });

function isPermissionError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'EACCES' || code === 'EPERM';
}

/**
 * Installs the plugin into D2RLoader's plugin folder of the D2R folder, writes its connection
 * settings into its config file, and removes both again. D2R is often installed under Program
 * Files, where writing needs administrator rights: when a write is refused, the changes are made
 * by an elevated PowerShell instead (Windows only).
 */
export class PluginInstaller {
  private readonly runElevated: RunElevated;
  private readonly platform: NodeJS.Platform;

  constructor(private readonly deps: PluginInstallerDependencies) {
    this.runElevated = deps.runElevated ?? runElevatedPowerShell;
    this.platform = deps.platform ?? process.platform;
  }

  /** Finds D2RLoader and the plugin in the D2R folder. */
  async getInstallation(): Promise<D2RLoaderInstallation> {
    const gameFolder = this.deps.getGameFolder();
    const bundled = await readOptionalFile(this.deps.bundledPluginPath);
    if (!gameFolder) {
      return {
        loaderFound: false,
        pluginBundled: bundled !== undefined,
        pluginInstalled: false,
        pluginUpToDate: false,
        configured: false,
      };
    }

    const paths = getPluginPaths(gameFolder);
    const installed = await readOptionalFile(paths.dll);
    const config = await readOptionalFile(paths.config);
    const expected = this.deps.getConnectionSettings();
    const actual = config ? readPluginConfig(config.toString('utf8')) : {};
    return {
      gameFolder,
      loaderFound: existsSync(paths.loader),
      pluginBundled: bundled !== undefined,
      pluginInstalled: installed !== undefined,
      pluginUpToDate:
        installed !== undefined && bundled !== undefined && sha256(installed) === sha256(bundled),
      configured: actual.port === expected.port && actual.token === expected.token,
    };
  }

  /**
   * Copies the plugin this build ships into D2RLoader's plugin folder, unless the same file is
   * there already, and writes the app's port and token into the plugin's config file. A plugin
   * installed from the D2RLoader hub by a build without a bundled plugin is only configured.
   * @throws When there is no D2R folder, D2RLoader isn't in it, or there is no plugin to configure
   */
  async install(): Promise<D2RLoaderInstallResult> {
    const installation = await this.getInstallation();
    const gameFolder = installation.gameFolder;
    if (!gameFolder || !installation.loaderFound) {
      throw new Error('D2RLoader was not found in the D2R folder');
    }
    if (!installation.pluginBundled && !installation.pluginInstalled) {
      throw new Error('This build does not include the D2RLoader plugin');
    }

    const paths = getPluginPaths(gameFolder);
    const config = await readOptionalFile(paths.config);
    const writes: PlannedWrite[] = [
      {
        target: paths.config,
        content: writePluginConfig(config?.toString('utf8'), this.deps.getConnectionSettings()),
      },
    ];
    if (installation.pluginBundled && !installation.pluginUpToDate) {
      writes.unshift({ target: paths.dll, source: this.deps.bundledPluginPath });
    }
    return this.apply(
      { writes, removals: [] },
      (result) => result.pluginInstalled && result.configured,
    );
  }

  /** Removes the plugin and its config file from the D2R folder. */
  async uninstall(): Promise<D2RLoaderInstallResult> {
    const gameFolder = this.deps.getGameFolder();
    if (!gameFolder) {
      throw new Error('The D2R folder is not set');
    }
    const paths = getPluginPaths(gameFolder);
    return this.apply(
      { writes: [], removals: [paths.dll, paths.config] },
      (result) => !result.pluginInstalled,
    );
  }

  /**
   * Makes the changes directly, or with administrator rights when the D2R folder refuses them.
   * @param changes - Files to write and remove
   * @param succeeded - Whether the installation afterwards shows the changes
   * @returns The installation afterwards; `canceled` when the elevated attempt didn't make the changes
   */
  private async apply(
    changes: FileChanges,
    succeeded: (installation: D2RLoaderInstallation) => boolean,
  ): Promise<D2RLoaderInstallResult> {
    try {
      await this.applyDirectly(changes);
    } catch (error) {
      if (!isPermissionError(error) || this.platform !== 'win32') {
        throw error;
      }
      log.info('apply', 'The D2R folder needs administrator rights, asking for them');
      await this.applyElevated(changes);
      const installation = await this.getInstallation();
      return succeeded(installation) ? { installation } : { installation, canceled: true };
    }
    return { installation: await this.getInstallation() };
  }

  private async applyDirectly({ writes, removals }: FileChanges): Promise<void> {
    for (const write of writes) {
      await mkdir(path.dirname(write.target), { recursive: true });
      if (write.source) {
        await copyFile(write.source, write.target);
      } else {
        await writeFile(write.target, write.content ?? '', 'utf8');
      }
    }
    for (const removal of removals) {
      await rm(removal, { force: true });
    }
  }

  /**
   * Makes the changes with an elevated script that holds everything it needs: the content of a
   * config file is part of the script, and a file to copy is read once by the script, checked
   * against the SHA-256 this process computed and written from the bytes it checked. Another
   * process that replaces such a file while the administrator prompt is open makes the script fail.
   */
  private async applyElevated({ writes, removals }: FileChanges): Promise<void> {
    const lines = [
      "$ErrorActionPreference = 'Stop'",
      'function Put($target, [byte[]]$bytes) { New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($target)) | Out-Null; [IO.File]::WriteAllBytes($target, $bytes) }',
      "function PutVerified($source, $hash, $target) { $bytes = [IO.File]::ReadAllBytes($source); if (([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace('-', '')) -ne $hash) { throw 'The source file changed' }; Put $target $bytes }",
    ];
    for (const write of writes) {
      if (write.source) {
        const hash = sha256(await readFile(write.source));
        lines.push(
          `PutVerified ${quotePowerShell(write.source)} ${quotePowerShell(hash)} ${quotePowerShell(write.target)}`,
        );
      } else {
        const content = Buffer.from(write.content ?? '', 'utf8').toString('base64');
        lines.push(
          `Put ${quotePowerShell(write.target)} ([Convert]::FromBase64String('${content}'))`,
        );
      }
    }
    for (const removal of removals) {
      lines.push(
        `if (Test-Path -LiteralPath ${quotePowerShell(removal)}) { Remove-Item -LiteralPath ${quotePowerShell(removal)} -Force }`,
      );
    }
    const script = lines.join('\r\n');
    const commandLength = buildElevationCommand(script).length;
    if (commandLength > MAX_ELEVATION_COMMAND_LENGTH) {
      log.error(
        'applyElevated',
        `The elevated command has ${commandLength} characters and Windows would refuse it, nothing was changed`,
      );
      return;
    }
    if (!(await this.runElevated(script))) {
      log.warn('applyElevated', 'The elevated script failed or the prompt was declined');
    }
  }
}
