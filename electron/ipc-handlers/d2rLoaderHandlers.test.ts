/** biome-ignore-all lint/suspicious/noExplicitAny: handlers are retrieved from mocked ipcMain.handle calls */
import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunCounterImportDatabase } from '../services/d2rLoader/runCounterImport';
import { initializeD2RLoaderHandlers } from './d2rLoaderHandlers';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}));

const runCounter = vi.hoisted(() => ({
  importRunCounterData: vi.fn(),
  resolveRunCounterFolder: vi.fn(async (gameFolder: string) => `${gameFolder}/run-counter`),
}));
vi.mock('../services/d2rLoader/runCounterImport', () => runCounter);

function getHandler(channel: string) {
  return vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === channel)?.[1] as any;
}

const CHANNELS = [
  'd2rLoader:getInstallation',
  'd2rLoader:getStatus',
  'd2rLoader:importRunCounter',
  'd2rLoader:installPlugin',
  'd2rLoader:uninstallPlugin',
];

describe('When the D2RLoader handlers are initialized', () => {
  const bridge = { getStatus: vi.fn() };
  const installer = { getInstallation: vi.fn(), install: vi.fn(), uninstall: vi.fn() };
  const database = {} as RunCounterImportDatabase;
  let gameFolder: string | undefined;
  let dispose: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    gameFolder = '/games/d2r';
    dispose = initializeD2RLoaderHandlers({
      bridge,
      installer: installer as never,
      database,
      getGameFolder: () => gameFolder,
    });
  });

  it('If they are disposed, Then every channel is handled and removed again', () => {
    // Arrange
    const channels = vi.mocked(ipcMain.handle).mock.calls.map((call) => call[0]);

    // Act
    dispose();

    // Assert
    expect(channels.sort()).toEqual(CHANNELS);
    expect(
      vi
        .mocked(ipcMain.removeHandler)
        .mock.calls.map((call) => call[0])
        .sort(),
    ).toEqual(CHANNELS);
  });

  it('Then the status, installation and plugin changes come from the bridge and the installer', async () => {
    // Arrange
    bridge.getStatus.mockReturnValue({ connected: true });
    installer.getInstallation.mockResolvedValue({ loaderFound: true });
    installer.install.mockResolvedValue({ installation: { pluginInstalled: true } });
    installer.uninstall.mockResolvedValue({ installation: { pluginInstalled: false } });

    // Act
    const results = [
      await getHandler('d2rLoader:getStatus')({}),
      await getHandler('d2rLoader:getInstallation')({}),
      await getHandler('d2rLoader:installPlugin')({}),
      await getHandler('d2rLoader:uninstallPlugin')({}),
    ];

    // Assert
    expect(results).toEqual([
      { connected: true },
      { loaderFound: true },
      { installation: { pluginInstalled: true } },
      { installation: { pluginInstalled: false } },
    ]);
  });

  it('If Run Counter history is imported, Then it is read from the Run Counter folder in the D2R folder', async () => {
    // Arrange
    const imported = { folder: '/games/d2r/run-counter', found: true, runs: 3 };
    runCounter.importRunCounterData.mockResolvedValue(imported);

    // Act
    const result = await getHandler('d2rLoader:importRunCounter')({});

    // Assert
    expect(runCounter.resolveRunCounterFolder).toHaveBeenCalledWith('/games/d2r');
    expect(runCounter.importRunCounterData).toHaveBeenCalledWith(
      database,
      '/games/d2r/run-counter',
    );
    expect(result).toBe(imported);
  });

  it('If no D2R folder is set, Then importing rejects', async () => {
    // Arrange
    gameFolder = undefined;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    const result = getHandler('d2rLoader:importRunCounter')({});

    // Assert
    await expect(result).rejects.toThrow('The D2R folder is not set');
    expect(runCounter.importRunCounterData).not.toHaveBeenCalled();
  });
});
