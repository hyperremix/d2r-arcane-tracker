import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const calls: string[] = [];
  const log = (call: string) => () => {
    calls.push(call);
  };
  const disposer = (name: string) => vi.fn(() => log(`${name}.dispose`));
  return {
    calls,
    log,
    GrailDatabase: vi.fn(function GrailDatabase() {
      return {
        close: log('database.close'),
        getAllSettings: () => ({}),
        setSetting: vi.fn(),
        getAllItems: () => [],
        getAllProgress: () => [],
      };
    }),
    windows: [] as Array<{ isDestroyed: () => boolean; close: () => void; destroy: () => void }>,
    initializeSaveFileHandlers: disposer('saveFileHandlers'),
    initializeRunTrackerHandlers: disposer('runTrackerHandlers'),
    initializeGlobalHotkeyHandlers: disposer('globalHotkeyHandlers'),
  };
});

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/user-data') },
  BrowserWindow: { getAllWindows: vi.fn(() => mocks.windows) },
  webContents: { getAllWebContents: vi.fn(() => []) },
}));

vi.mock('../database/database', () => ({ GrailDatabase: mocks.GrailDatabase }));

vi.mock('../ipc-handlers/appWindowHandlers', () => ({ initializeAppWindowHandlers: vi.fn() }));
vi.mock('../ipc-handlers/dialogHandlers', () => ({ initializeDialogHandlers: vi.fn() }));
vi.mock('../ipc-handlers/globalHotkeyHandlers', () => ({
  initializeGlobalHotkeyHandlers: mocks.initializeGlobalHotkeyHandlers,
}));
vi.mock('../ipc-handlers/grailHandlers', () => ({
  addSettingsUpdatedListener: vi.fn(),
  initializeGrailHandlers: vi.fn(),
}));
vi.mock('../ipc-handlers/iconHandlers', () => ({ initializeIconHandlers: vi.fn() }));
vi.mock('../ipc-handlers/inventoryWindowHandlers', () => ({
  initializeInventoryWindowHandlers: vi.fn(),
}));
vi.mock('../ipc-handlers/runTrackerHandlers', () => ({
  initializeRunTrackerHandlers: mocks.initializeRunTrackerHandlers,
}));
vi.mock('../ipc-handlers/saveFileHandlers', () => ({
  initializeSaveFileHandlers: mocks.initializeSaveFileHandlers,
}));
vi.mock('../ipc-handlers/shellHandlers', () => ({ initializeShellHandlers: vi.fn() }));
vi.mock('../ipc-handlers/terrorZoneHandlers', () => ({ initializeTerrorZoneHandlers: vi.fn() }));
vi.mock('../ipc-handlers/updateHandlers', () => ({ initializeUpdateHandlers: vi.fn() }));
vi.mock('../ipc-handlers/vaultHandlers', () => ({ initializeVaultHandlers: vi.fn() }));
vi.mock('../ipc-handlers/widgetHandlers', () => ({ initializeWidgetHandlers: vi.fn() }));

vi.mock('../services/gameProcessGuard', () => ({ createGameProcessGuard: vi.fn(() => vi.fn()) }));
vi.mock('../services/globalHotkeys', () => ({
  GlobalHotkeyService: vi.fn(function GlobalHotkeyService() {
    return { dispose: mocks.log('hotkeys.dispose') };
  }),
}));
vi.mock('../services/iconService', () => ({ IconService: vi.fn() }));
vi.mock('../services/itemDetection', () => ({
  ItemDetectionService: vi.fn(function ItemDetectionService() {
    return { setGrailItems: vi.fn(), initializeFromDatabase: vi.fn() };
  }),
}));
vi.mock('../services/memoryReader', () => ({ MemoryReader: vi.fn() }));
vi.mock('../services/processMonitor', () => ({ ProcessMonitor: vi.fn() }));
vi.mock('../services/runTracker', () => ({
  RunTrackerService: vi.fn(function RunTrackerService() {
    return { shutdown: mocks.log('runTracker.shutdown') };
  }),
}));
vi.mock('../services/saveFileBackup', () => ({ configureSaveFileBackups: vi.fn() }));
vi.mock('../services/saveFileEditor', () => ({}));
vi.mock('../services/saveFileMonitor', () => ({
  SaveFileMonitor: vi.fn(function SaveFileMonitor() {
    return {
      start: mocks.log('saveFileMonitor.start'),
      shutdown: vi.fn(async () => {
        await Promise.resolve();
        mocks.calls.push('saveFileMonitor.shutdown');
      }),
      startMonitoring: vi.fn(),
      getSaveDirectory: vi.fn(),
    };
  }),
}));
vi.mock('../services/terrorZoneService', () => ({ TerrorZoneService: vi.fn() }));
vi.mock('../services/updateService', () => ({ UpdateService: vi.fn() }));
vi.mock('../utils/serviceLogger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  setErrorForwarder: vi.fn(),
}));
vi.mock('../window/mainWindow', () => ({
  createMainWindow: vi.fn(),
  getMainWindow: vi.fn(),
}));
vi.mock('../window/widgetWindow', () => ({ showWidgetWindow: vi.fn() }));

import { initializeUpdateHandlers } from '../ipc-handlers/updateHandlers';
import { RunTrackerService } from '../services/runTracker';
import { type RunningApp, startApp as start } from './bootstrap';
import type { AppPaths } from './paths';

const env: AppPaths = {
  appRoot: '/app',
  mainDist: '/app/dist-electron',
  rendererDist: '/app/dist',
  publicDir: '/app/dist',
};
const runningApps: RunningApp[] = [];

async function startApp(environment: typeof env): Promise<RunningApp> {
  const runningApp = await start(environment);
  runningApps.push(runningApp);
  return runningApp;
}

function createWindow() {
  let destroyed = false;
  const closedListeners: Array<() => void> = [];
  return {
    isDestroyed: () => destroyed,
    close: () => {
      mocks.calls.push('window.close');
      destroyed = true;
      for (const listener of closedListeners) {
        listener();
      }
    },
    destroy: () => {
      destroyed = true;
    },
    once: (_event: 'closed', listener: () => void) => {
      closedListeners.push(listener);
    },
  };
}

describe('When the app is bootstrapped', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls.length = 0;
    mocks.windows = [createWindow()];
  });

  afterEach(async () => {
    // Shuts down every started app
    await Promise.all(runningApps.splice(0).map((runningApp) => runningApp.shutdown()));
  });

  it('Then the database is opened by startApp, not when the module is imported', async () => {
    // Arrange
    const openedBeforeStart = mocks.GrailDatabase.mock.calls.length;

    // Act
    await startApp(env);

    // Assert
    expect(openedBeforeStart).toBe(0);
    expect(mocks.GrailDatabase).toHaveBeenCalledTimes(1);
  });

  it('Then the save file monitor is started once, and stopped again on shutdown', async () => {
    // Arrange
    const runningApp = await startApp(env);

    // Act
    await runningApp.shutdown();

    // Assert
    expect(mocks.calls.filter((call) => call === 'saveFileMonitor.start')).toHaveLength(1);
    expect(mocks.calls.indexOf('saveFileMonitor.start')).toBeLessThan(
      mocks.calls.indexOf('saveFileMonitor.shutdown'),
    );
    expect(mocks.calls.indexOf('saveFileMonitor.shutdown')).toBeLessThan(
      mocks.calls.indexOf('database.close'),
    );
  });

  describe('If the app shuts down', () => {
    it('Then hotkeys, run tracker and monitoring stop before the windows close and the database closes last', async () => {
      // Arrange
      const runningApp = await startApp(env);

      // Act
      await runningApp.shutdown();

      // Assert
      const order = (call: string) => mocks.calls.indexOf(call);
      expect(mocks.calls[mocks.calls.length - 1]).toBe('database.close');
      expect(order('hotkeys.dispose')).toBeLessThan(order('runTracker.shutdown'));
      expect(order('runTracker.shutdown')).toBeLessThan(order('saveFileMonitor.shutdown'));
      expect(order('saveFileMonitor.shutdown')).toBeLessThan(order('window.close'));
      expect(order('window.close')).toBeLessThan(order('database.close'));
    });

    it('Then the event forwarding of the handlers is removed before the services stop', async () => {
      // Arrange
      const runningApp = await startApp(env);

      // Act
      await runningApp.shutdown();

      // Assert
      const order = (call: string) => mocks.calls.indexOf(call);
      expect(order('globalHotkeyHandlers.dispose')).toBeGreaterThanOrEqual(0);
      expect(order('saveFileHandlers.dispose')).toBeLessThan(order('runTracker.shutdown'));
      expect(order('runTrackerHandlers.dispose')).toBeLessThan(order('runTracker.shutdown'));
    });

    it('If shutdown is requested again, Then nothing is closed twice', async () => {
      // Arrange
      const runningApp = await startApp(env);
      await runningApp.shutdown();

      // Act
      await runningApp.shutdown();

      // Assert
      expect(mocks.calls.filter((call) => call === 'database.close')).toHaveLength(1);
    });
  });
});

describe('When a startup step fails midway', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls.length = 0;
    mocks.windows = [createWindow()];
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('Then the started parts are torn down in reverse order and the error propagates', async () => {
    // Arrange
    const failure = new Error('update handlers failed');
    vi.mocked(initializeUpdateHandlers).mockImplementationOnce(() => {
      throw failure;
    });

    // Act
    const result = start(env);

    // Assert
    await expect(result).rejects.toBe(failure);
    const order = (call: string) => mocks.calls.indexOf(call);
    expect(order('hotkeys.dispose')).toBeLessThan(order('runTrackerHandlers.dispose'));
    expect(order('runTrackerHandlers.dispose')).toBeLessThan(order('saveFileHandlers.dispose'));
    expect(order('saveFileHandlers.dispose')).toBeLessThan(order('runTracker.shutdown'));
    expect(order('runTracker.shutdown')).toBeLessThan(order('saveFileMonitor.shutdown'));
    expect(order('saveFileMonitor.shutdown')).toBeLessThan(order('window.close'));
    expect(mocks.calls[mocks.calls.length - 1]).toBe('database.close');
  });

  it('If a step fails before the windows exist, Then the database is still closed without teardown errors', async () => {
    // Arrange
    const failure = new Error('run tracker failed');
    vi.mocked(RunTrackerService).mockImplementationOnce(function RunTrackerService() {
      throw failure;
    });

    // Act
    const result = start(env);

    // Assert
    await expect(result).rejects.toBe(failure);
    expect(mocks.calls).toContain('saveFileMonitor.shutdown');
    expect(mocks.calls).not.toContain('runTracker.shutdown');
    expect(mocks.calls[mocks.calls.length - 1]).toBe('database.close');
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining('[shutdown]'),
      expect.anything(),
    );
  });

  it('If a teardown step also fails, Then the original startup error still propagates', async () => {
    // Arrange
    const failure = new Error('update handlers failed');
    vi.mocked(initializeUpdateHandlers).mockImplementationOnce(() => {
      throw failure;
    });
    mocks.windows = [
      {
        isDestroyed: () => false,
        close: () => {
          throw new Error('window close failed');
        },
        destroy: () => undefined,
      },
    ];
    vi.useFakeTimers();

    try {
      // Act
      const result = start(env);
      const assertion = expect(result).rejects.toBe(failure);
      await vi.advanceTimersByTimeAsync(10_000);

      // Assert
      await assertion;
      expect(mocks.calls[mocks.calls.length - 1]).toBe('database.close');
    } finally {
      vi.useRealTimers();
    }
  });
});
