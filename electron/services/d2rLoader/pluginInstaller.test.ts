import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildElevationCommand,
  PluginInstaller,
  quotePowerShell,
  readPluginConfig,
  writePluginConfig,
} from './pluginInstaller';

const CONNECTION = { port: 41733, token: 'a'.repeat(64) };

describe('When writePluginConfig sets the connection settings', () => {
  it('If there is no config file yet, Then it writes the plugin table with port and token', () => {
    // Act
    const config = writePluginConfig(undefined, CONNECTION);

    // Assert
    expect(config).toBe(`[arcane-tracker]\nport = 41733\ntoken = "${CONNECTION.token}"\n`);
  });

  it('If the file has the keys, Then only their values change and everything else is kept', () => {
    // Arrange
    const existing = [
      '# Arcane Tracker',
      '[arcane-tracker]',
      'enabled = true',
      'port   =  1234 # written by the tracker',
      'token = ""',
      'overlay = false',
      '',
      '[d2rl]',
      'port = 9',
    ].join('\r\n');

    // Act
    const config = writePluginConfig(existing, CONNECTION);

    // Assert
    expect(config).toBe(
      [
        '# Arcane Tracker',
        '[arcane-tracker]',
        'enabled = true',
        'port   =  41733 # written by the tracker',
        `token = "${CONNECTION.token}"`,
        'overlay = false',
        '',
        '[d2rl]',
        'port = 9',
        '',
      ].join('\r\n'),
    );
  });

  it('If the table lacks a key, Then the key is added after the table header', () => {
    // Arrange
    const existing = '[arcane-tracker]\noverlay = false\n';

    // Act
    const config = writePluginConfig(existing, CONNECTION);

    // Assert
    expect(readPluginConfig(config)).toEqual(CONNECTION);
    expect(config).toContain('overlay = false');
  });
});

describe('When readPluginConfig reads the connection settings', () => {
  it('Then it reads port and token from the plugin table only', () => {
    // Arrange
    const config = `[d2rl]\nport = 1\n[arcane-tracker]\nport = 41733\ntoken = "${CONNECTION.token}"\n`;

    // Act
    const values = readPluginConfig(config);

    // Assert
    expect(values).toEqual(CONNECTION);
  });
});

describe('When a value is quoted for PowerShell', () => {
  it.each([
    ["O'Brien", "'O''Brien'"],
    ['O\u2018Brien', "'O\u2018\u2018Brien'"],
    ['O\u2019Brien', "'O\u2019\u2019Brien'"],
    ['O\u201ABrien', "'O\u201A\u201ABrien'"],
    ['O\u201BBrien', "'O\u201B\u201BBrien'"],
    ['C:\\Games\\D2R', "'C:\\Games\\D2R'"],
  ])('If the value is %s, Then every single-quote variant is doubled', (value, expected) => {
    // Act
    const quoted = quotePowerShell(value);

    // Assert
    expect(quoted).toBe(expected);
  });
});

describe('When the elevated PowerShell command is built', () => {
  it('Then the script travels as -EncodedCommand and no script file is named', () => {
    // Arrange
    const script = "Put 'C:\\Games\\Diablo II Resurrected\\d2rloader\\config\\arcane-tracker.toml'";

    // Act
    const command = buildElevationCommand(script);

    // Assert
    const encoded = /'-EncodedCommand','([^']+)'/.exec(command)?.[1] ?? '';
    expect(Buffer.from(encoded, 'base64').toString('utf16le')).toBe(script);
    expect(command).not.toMatch(/'-File'|\.ps1/);
    expect(command).toContain('-Verb RunAs');
  });

  it('If every path is as long as Windows allows, Then the command stays below the command line limit', () => {
    // Arrange
    const longPath = `C:\\${'a'.repeat(250)}`;
    const script = [
      `PutVerified '${longPath}' '${'f'.repeat(64)}' '${longPath}'`,
      `Put '${longPath}' ([Convert]::FromBase64String('${'A'.repeat(400)}'))`,
      `if (Test-Path -LiteralPath '${longPath}') { Remove-Item -LiteralPath '${longPath}' -Force }`,
    ]
      .join('\r\n')
      .padEnd(2_000, ' ');

    // Act
    const command = buildElevationCommand(script);

    // Assert
    expect(
      command.length + 'powershell.exe -NoProfile -NonInteractive -Command '.length,
    ).toBeLessThan(32_767);
  });
});

describe('When the plugin installer works on a D2R folder', () => {
  let root: string;
  let gameFolder: string;
  let bundledPluginPath: string;
  let pluginPath: string;
  let configPath: string;

  const createInstaller = (
    overrides: Partial<ConstructorParameters<typeof PluginInstaller>[0]> = {},
  ) =>
    new PluginInstaller({
      getGameFolder: () => gameFolder,
      bundledPluginPath,
      getConnectionSettings: () => CONNECTION,
      ...overrides,
    });

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'plugin-installer-test-'));
    gameFolder = path.join(root, 'Diablo II Resurrected');
    await mkdir(gameFolder, { recursive: true });
    await writeFile(path.join(gameFolder, 'D2RLoader.exe'), 'loader');
    bundledPluginPath = path.join(root, 'resources', 'd2rl-arcane-tracker.dll');
    await mkdir(path.dirname(bundledPluginPath), { recursive: true });
    await writeFile(bundledPluginPath, 'plugin v1');
    pluginPath = path.join(gameFolder, 'd2rloader', 'plugins', 'd2rl-arcane-tracker.dll');
    configPath = path.join(gameFolder, 'd2rloader', 'config', 'arcane-tracker.toml');
  });

  afterEach(async () => {
    await chmod(gameFolder, 0o755).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  });

  it('If D2RLoader is installed, Then installing copies the plugin and writes its connection settings', async () => {
    // Act
    const { installation, canceled } = await createInstaller().install();

    // Assert
    expect(canceled).toBeUndefined();
    expect(await readFile(pluginPath, 'utf8')).toBe('plugin v1');
    expect(readPluginConfig(await readFile(configPath, 'utf8'))).toEqual(CONNECTION);
    expect(installation).toEqual({
      gameFolder,
      loaderFound: true,
      pluginBundled: true,
      pluginInstalled: true,
      pluginUpToDate: true,
      configured: true,
    });
  });

  it('If another plugin version is installed, Then it is reported as outdated and replaced', async () => {
    // Arrange
    await mkdir(path.dirname(pluginPath), { recursive: true });
    await writeFile(pluginPath, 'plugin v0');
    const installer = createInstaller();

    // Act
    const before = await installer.getInstallation();
    await installer.install();

    // Assert
    expect(before).toMatchObject({
      pluginInstalled: true,
      pluginUpToDate: false,
      configured: false,
    });
    expect(await readFile(pluginPath, 'utf8')).toBe('plugin v1');
  });

  it('If this build has no plugin but one is installed from the hub, Then installing only configures it', async () => {
    // Arrange
    await mkdir(path.dirname(pluginPath), { recursive: true });
    await writeFile(pluginPath, 'plugin from the hub');
    const installer = createInstaller({ bundledPluginPath: path.join(root, 'missing.dll') });

    // Act
    const { installation } = await installer.install();

    // Assert
    expect(await readFile(pluginPath, 'utf8')).toBe('plugin from the hub');
    expect(installation).toMatchObject({ pluginBundled: false, configured: true });
  });

  it('If D2RLoader is missing, Then installing throws', async () => {
    // Arrange
    await rm(path.join(gameFolder, 'D2RLoader.exe'));

    // Act
    const install = createInstaller().install();

    // Assert
    await expect(install).rejects.toThrow('D2RLoader was not found');
  });

  it('Then removing the plugin deletes the plugin and its config file', async () => {
    // Arrange
    const installer = createInstaller();
    await installer.install();

    // Act
    const { installation } = await installer.uninstall();

    // Assert
    expect(installation).toMatchObject({ pluginInstalled: false, configured: false });
  });

  /**
   * Stands in for the administrator: carries out the script's Put and PutVerified calls with the
   * checks PowerShell does, without a script file.
   */
  async function runScriptAsAdministrator(script: string): Promise<boolean> {
    await chmod(gameFolder, 0o755);
    for (const [, source, hash, target] of script.matchAll(
      /^PutVerified '([^']+)' '([^']+)' '([^']+)'$/gm,
    )) {
      const bytes = await readFile(source);
      if (createHash('sha256').update(bytes).digest('hex') !== hash) return false;
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    for (const [, target, content] of script.matchAll(
      /^Put '([^']+)' \(\[Convert\]::FromBase64String\('([^']+)'\)\)$/gm,
    )) {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(content, 'base64'));
    }
    return true;
  }

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'If the D2R folder needs administrator rights on Windows, Then an elevated script makes the changes',
    async () => {
      // Arrange
      await chmod(gameFolder, 0o555);
      const runElevated = vi.fn(runScriptAsAdministrator);

      // Act
      const { installation, canceled } = await createInstaller({
        runElevated,
        platform: 'win32',
      }).install();

      // Assert
      expect(runElevated).toHaveBeenCalledTimes(1);
      expect(canceled).toBeUndefined();
      expect(installation).toMatchObject({ pluginInstalled: true, configured: true });
      expect(await readFile(pluginPath, 'utf8')).toBe('plugin v1');
    },
  );

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'If the elevated script is built, Then it carries the config and the hash of the plugin and reads no staged copy',
    async () => {
      // Arrange
      await chmod(gameFolder, 0o555);
      const runElevated = vi.fn(async (_script: string) => false);

      // Act
      await createInstaller({ runElevated, platform: 'win32' }).install();

      // Assert
      const script = runElevated.mock.calls[0][0];
      const expectedHash = createHash('sha256').update('plugin v1').digest('hex');
      expect(script).toContain(`PutVerified '${bundledPluginPath}' '${expectedHash}'`);
      expect(script).toContain(
        Buffer.from(`[arcane-tracker]\nport = 41733\ntoken = "${CONNECTION.token}"\n`).toString(
          'base64',
        ),
      );
      expect(script).not.toContain('Copy-Item');
      expect(script).not.toContain('arcane-tracker-plugin-');
    },
  );

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'If the plugin file is replaced while the administrator prompt is open, Then the script refuses it and the result is canceled',
    async () => {
      // Arrange
      await chmod(gameFolder, 0o555);
      const runElevated = vi.fn(async (script: string) => {
        await writeFile(bundledPluginPath, 'malicious plugin');
        return runScriptAsAdministrator(script);
      });

      // Act
      const result = await createInstaller({ runElevated, platform: 'win32' }).install();

      // Assert
      expect(result.canceled).toBe(true);
      expect(result.installation.pluginInstalled).toBe(false);
    },
  );

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'If the administrator prompt is declined, Then the result is canceled',
    async () => {
      // Arrange
      await chmod(gameFolder, 0o555);
      const runElevated = vi.fn(async () => false);

      // Act
      const result = await createInstaller({ runElevated, platform: 'win32' }).install();

      // Assert
      expect(result.canceled).toBe(true);
      expect(result.installation.pluginInstalled).toBe(false);
    },
  );
});
