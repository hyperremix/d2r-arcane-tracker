import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginInstaller, readPluginConfig, writePluginConfig } from './pluginInstaller';

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

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'If the D2R folder needs administrator rights on Windows, Then an elevated script makes the changes',
    async () => {
      // Arrange
      await chmod(gameFolder, 0o555);
      const runElevated = vi.fn(async (script: string) => {
        // Stands in for the administrator: the script names the staged files and their targets
        await chmod(gameFolder, 0o755);
        for (const [, source, target] of script.matchAll(
          /Copy-Item -LiteralPath '([^']+)' -Destination '([^']+)'/g,
        )) {
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, await readFile(source));
        }
        return true;
      });

      // Act
      const { installation, canceled } = await createInstaller({
        runElevated,
        platform: 'win32',
      }).install();

      // Assert
      expect(runElevated).toHaveBeenCalledTimes(1);
      expect(canceled).toBeUndefined();
      expect(installation).toMatchObject({ pluginInstalled: true, configured: true });
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
