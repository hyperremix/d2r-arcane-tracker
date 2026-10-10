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
    WindowsMemoryReaderImpl: vi.fn(function WindowsMemoryReaderImpl() {
      return { kind: 'win32-process-memory' };
    }),
    // Subscribes like the real save file handlers, which forward every event to the renderers
    initializeSaveFileHandlers: vi.fn(
      (deps: { eventBus: import('../services/EventBus').EventBus }) => {
        const unsubscribe = deps.eventBus.on('save-file-event', () => {
          calls.push('saveFileHandlers.forwardToRenderers');
        });
        return () => {
          unsubscribe();
          calls.push('saveFileHandlers.dispose');
        };
      },
    ),
    initializeRunTrackerHandlers: disposer('runTrackerHandlers'),
    initializeGlobalHotkeyHandlers: disposer('globalHotkeyHandlers'),
    initializeAppWindowHandlers: disposer('appWindowHandlers'),
    initializeDialogHandlers: disposer('dialogHandlers'),
    initializeGrailHandlers: disposer('grailHandlers'),
    initializeIconHandlers: disposer('iconHandlers'),
    initializeInventoryWindowHandlers: disposer('inventoryWindowHandlers'),
    initializeShellHandlers: disposer('shellHandlers'),
    initializeTerrorZoneHandlers: disposer('terrorZoneHandlers'),
    initializeUpdateHandlers: disposer('updateHandlers'),
    initializeVaultHandlers: disposer('vaultHandlers'),
    initializeWidgetHandlers: disposer('widgetHandlers'),
  };
});

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/user-data') },
  BrowserWindow: { getAllWindows: vi.fn(() => mocks.windows) },
  webContents: { getAllWebContents: vi.fn(() => []) },
}));

vi.mock('../database/database', () => ({ GrailDatabase: mocks.GrailDatabase }));

vi.mock('../ipc-handlers/appWindowHandlers', () => ({
  initializeAppWindowHandlers: mocks.initializeAppWindowHandlers,
}));
vi.mock('../ipc-handlers/dialogHandlers', () => ({
  initializeDialogHandlers: mocks.initializeDialogHandlers,
}));
vi.mock('../ipc-handlers/globalHotkeyHandlers', () => ({
  initializeGlobalHotkeyHandlers: mocks.initializeGlobalHotkeyHandlers,
}));
vi.mock('../ipc-handlers/grailHandlers', () => ({
  addSettingsUpdatedListener: vi.fn(),
  initializeGrailHandlers: mocks.initializeGrailHandlers,
}));
vi.mock('../ipc-handlers/iconHandlers', () => ({
  initializeIconHandlers: mocks.initializeIconHandlers,
}));
vi.mock('../ipc-handlers/inventoryWindowHandlers', () => ({
  initializeInventoryWindowHandlers: mocks.initializeInventoryWindowHandlers,
}));
vi.mock('../ipc-handlers/runTrackerHandlers', () => ({
  initializeRunTrackerHandlers: mocks.initializeRunTrackerHandlers,
}));
vi.mock('../ipc-handlers/saveFileHandlers', () => ({
  initializeSaveFileHandlers: mocks.initializeSaveFileHandlers,
}));
vi.mock('../ipc-handlers/shellHandlers', () => ({
  initializeShellHandlers: mocks.initializeShellHandlers,
}));
vi.mock('../ipc-handlers/terrorZoneHandlers', () => ({
  initializeTerrorZoneHandlers: mocks.initializeTerrorZoneHandlers,
}));
vi.mock('../ipc-handlers/updateHandlers', () => ({
  initializeUpdateHandlers: mocks.initializeUpdateHandlers,
}));
vi.mock('../ipc-handlers/vaultHandlers', () => ({
  initializeVaultHandlers: mocks.initializeVaultHandlers,
}));
vi.mock('../ipc-handlers/widgetHandlers', () => ({
  initializeWidgetHandlers: mocks.initializeWidgetHandlers,
}));

vi.mock('../services/gameProcessGuard', () => ({ createGameProcessGuard: vi.fn(() => vi.fn()) }));
vi.mock('../services/globalHotkeys', () => ({
  GlobalHotkeyService: vi.fn(function GlobalHotkeyService() {
    return { dispose: mocks.log('hotkeys.dispose') };
  }),
}));
vi.mock('../services/grailDetectionPipeline', () => ({
  GrailDetectionPipeline: vi.fn(function GrailDetectionPipeline(deps: {
    eventBus: import('../services/EventBus').EventBus;
  }) {
    let unsubscribe: (() => void) | undefined;
    return {
      // Subscribes like the real pipeline, which analyzes the items of every save file event
      start: () => {
        mocks.calls.push('detectionPipeline.start');
        unsubscribe = deps.eventBus.on('save-file-event', () => {
          mocks.calls.push('detectionPipeline.analyzeItems');
        });
      },
      dispose: () => {
        unsubscribe?.();
        mocks.calls.push('detectionPipeline.dispose');
      },
    };
  }),
}));
vi.mock('../services/iconService', () => ({ IconService: vi.fn() }));
vi.mock('../services/itemDetection', () => ({
  ItemDetectionService: vi.fn(function ItemDetectionService() {
    return { setGrailItems: vi.fn(), initializeFromDatabase: vi.fn() };
  }),
}));
vi.mock('../services/memoryReader', () => ({
  MemoryReader: vi.fn(function MemoryReader(eventBus: import('../services/EventBus').EventBus) {
    // Subscribes like the real memory reader, which reacts to the game process starting
    mocks.calls.push('memoryReader.subscribe');
    eventBus.on('d2r-started', mocks.log('memoryReader.receivedD2rStarted'));
    return { shutdown: vi.fn() };
  }),
}));
vi.mock('../services/processMonitor', () => ({
  ProcessMonitor: vi.fn(function ProcessMonitor(eventBus: import('../services/EventBus').EventBus) {
    return {
      // Like the real monitor, the first d2r-started follows the start asynchronously
      startMonitoring: vi.fn(() => {
        mocks.calls.push('processMonitor.start');
        queueMicrotask(() => {
          eventBus.emit('d2r-started', { processId: 4242, processName: 'D2R.exe' });
        });
      }),
      shutdown: vi.fn(),
    };
  }),
}));
vi.mock('../services/win32/processMemory', () => ({
  WindowsMemoryReaderImpl: mocks.WindowsMemoryReaderImpl,
}));
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
vi.mock('../services/updateService', () => ({
  UpdateService: vi.fn(function UpdateService() {
    return { dispose: mocks.log('updateService.dispose') };
  }),
}));
vi.mock('../utils/serviceLogger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  setErrorForwarder: vi.fn(),
}));
vi.mock('../window/mainWindow', () => ({
  createMainWindow: vi.fn(),
  getMainWindow: vi.fn(),
}));
vi.mock('../window/widgetWindow', () => ({
  createDebouncedWidgetSizeSaver: vi.fn(() => ({
    save: vi.fn(),
    flush: vi.fn(mocks.log('widgetSizeSaver.flush')),
  })),
  showWidgetWindow: vi.fn(),
}));

import { initializeUpdateHandlers } from '../ipc-handlers/updateHandlers';
import { EventBus } from '../services/EventBus';
import { createGameProcessGuard } from '../services/gameProcessGuard';
import { MemoryReader } from '../services/memoryReader';
import { ProcessMonitor } from '../services/processMonitor';
import { RunTrackerService } from '../services/runTracker';
import type { SaveFileEvent } from '../types/grail';
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

  it('Then the grail detection pipeline is started once, and disposed before monitoring stops', async () => {
    // Arrange
    const runningApp = await startApp(env);

    // Act
    await runningApp.shutdown();

    // Assert
    const order = (call: string) => mocks.calls.indexOf(call);
    expect(mocks.calls.filter((call) => call === 'detectionPipeline.start')).toHaveLength(1);
    expect(order('detectionPipeline.start')).toBeLessThan(order('detectionPipeline.dispose'));
    expect(order('detectionPipeline.dispose')).toBeLessThan(order('saveFileMonitor.shutdown'));
  });

  it('If a save file event is emitted, Then renderers receive it before the pipeline analyzes its items', async () => {
    // Arrange
    await startApp(env);
    const { eventBus } = mocks.initializeSaveFileHandlers.mock.calls[0][0];
    mocks.calls.length = 0;

    // Act
    await eventBus.emitAsync('save-file-event', {
      type: 'modified',
      file: { name: 'Hero' },
    } as unknown as SaveFileEvent);

    // Assert
    expect(mocks.calls).toEqual([
      'saveFileHandlers.forwardToRenderers',
      'detectionPipeline.analyzeItems',
    ]);
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
      expect(order('detectionPipeline.dispose')).toBeLessThan(order('runTracker.shutdown'));
      expect(order('runTrackerHandlers.dispose')).toBeLessThan(order('runTracker.shutdown'));
    });

    it('Then every IPC handler module and the update service are unregistered before the database closes', async () => {
      // Arrange
      const runningApp = await startApp(env);
      const teardowns = [
        'grailHandlers.dispose',
        'saveFileHandlers.dispose',
        'vaultHandlers.dispose',
        'runTrackerHandlers.dispose',
        'globalHotkeyHandlers.dispose',
        'dialogHandlers.dispose',
        'shellHandlers.dispose',
        'iconHandlers.dispose',
        'inventoryWindowHandlers.dispose',
        'terrorZoneHandlers.dispose',
        'updateHandlers.dispose',
        'widgetHandlers.dispose',
        'appWindowHandlers.dispose',
        'updateService.dispose',
      ];

      // Act
      await runningApp.shutdown();

      // Assert
      const order = (call: string) => mocks.calls.indexOf(call);
      for (const teardown of teardowns) {
        expect(order(teardown), teardown).toBeGreaterThanOrEqual(0);
        expect(order(teardown), teardown).toBeLessThan(order('database.close'));
      }
      expect(order('updateHandlers.dispose')).toBeLessThan(order('updateService.dispose'));
    });

    it('Then a pending widget size is flushed once before the windows close', async () => {
      // Arrange
      const runningApp = await startApp(env);

      // Act
      await runningApp.shutdown();

      // Assert
      const order = (call: string) => mocks.calls.indexOf(call);
      expect(mocks.calls.filter((call) => call === 'widgetSizeSaver.flush')).toHaveLength(1);
      expect(order('widgetSizeSaver.flush')).toBeLessThan(order('window.close'));
      expect(order('window.close')).toBeLessThan(order('database.close'));
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

describe('When the app starts', () => {
  const originalPlatform = process.platform;
  const processMemoryModule = '../services/win32/processMemory';

  // Registers the Win32 bindings module; the factory runs only when the module is imported
  function mockProcessMemory(factory: () => Record<string, unknown>): void {
    vi.doMock(processMemoryModule, factory);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls.length = 0;
    mocks.windows = [createWindow()];
  });

  afterEach(async () => {
    await Promise.all(runningApps.splice(0).map((runningApp) => runningApp.shutdown()));
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    mockProcessMemory(() => ({ WindowsMemoryReaderImpl: mocks.WindowsMemoryReaderImpl }));
  });

  it('If it runs on Windows, Then the memory reader gets the Win32 process memory bindings', async () => {
    // Arrange
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    // Act
    await startApp(env);

    // Assert
    expect(mocks.WindowsMemoryReaderImpl).toHaveBeenCalledTimes(1);
    expect(MemoryReader).toHaveBeenCalledWith(
      expect.any(EventBus),
      vi.mocked(mocks.WindowsMemoryReaderImpl).mock.results[0].value,
    );
  });

  it('If it runs on Windows, Then the memory reader subscribes before the first d2r-started event', async () => {
    // Arrange
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    // Act
    await startApp(env);

    // Assert
    await vi.waitFor(() => expect(mocks.calls).toContain('memoryReader.receivedD2rStarted'));
    expect(mocks.calls.indexOf('memoryReader.subscribe')).toBeLessThan(
      mocks.calls.indexOf('memoryReader.receivedD2rStarted'),
    );
  });

  it('If it runs on another platform, Then the Win32 bindings module is never imported', async () => {
    // Arrange
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    const evaluated = vi.fn();
    mockProcessMemory(() => {
      evaluated();
      return { WindowsMemoryReaderImpl: mocks.WindowsMemoryReaderImpl };
    });

    // Act
    await startApp(env);

    // Assert
    expect(evaluated).not.toHaveBeenCalled();
    expect(mocks.WindowsMemoryReaderImpl).not.toHaveBeenCalled();
    expect(MemoryReader).not.toHaveBeenCalled();
  });

  it('If it runs on Windows, Then the Win32 bindings module is imported (control for the test above)', async () => {
    // Arrange
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    const evaluated = vi.fn();
    mockProcessMemory(() => {
      evaluated();
      return { WindowsMemoryReaderImpl: mocks.WindowsMemoryReaderImpl };
    });

    // Act
    await startApp(env);

    // Assert
    expect(evaluated).toHaveBeenCalledTimes(1);
  });

  describe('If the Win32 bindings fail to load on Windows', () => {
    let consoleError: ReturnType<typeof vi.spyOn>;
    const loadFailure = new Error('koffi failed to load');

    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockProcessMemory(() => {
        throw loadFailure;
      });
    });

    afterEach(() => {
      consoleError.mockRestore();
    });

    it('Then the startup does not throw and the error is logged', async () => {
      // Arrange
      const startup = startApp(env);

      // Act
      const runningApp = await startup;

      // Assert
      expect(runningApp).toBeDefined();
      expect(consoleError).toHaveBeenCalledWith(
        '[bootstrap] Failed to load the Win32 memory bindings:',
        // Vitest wraps an error thrown by a module factory and keeps the original as its cause
        expect.objectContaining({ cause: loadFailure }),
      );
    });

    it('Then the memory reader is disabled', async () => {
      // Arrange
      const startup = startApp(env);

      // Act
      await startup;

      // Assert
      expect(mocks.WindowsMemoryReaderImpl).not.toHaveBeenCalled();
      expect(MemoryReader).not.toHaveBeenCalled();
      expect(vi.mocked(RunTrackerService).mock.calls[0][2]).toBeUndefined();
    });

    it('Then the process monitor still starts and the rest of the app comes up', async () => {
      // Arrange
      const startup = startApp(env);

      // Act
      await startup;

      // Assert
      expect(ProcessMonitor).toHaveBeenCalledTimes(1);
      expect(mocks.calls).toContain('processMonitor.start');
      expect(mocks.calls).toContain('saveFileMonitor.start');
      expect(mocks.calls).toContain('detectionPipeline.start');
    });

    it('Then the started process monitor is handed to the game process guard and stopped on shutdown', async () => {
      // Arrange
      const runningApp = await startApp(env);
      const processMonitor = vi.mocked(ProcessMonitor).mock.results[0].value;

      // Act
      await runningApp.shutdown();

      // Assert
      expect(createGameProcessGuard).toHaveBeenCalledWith({ processMonitor });
      expect(processMonitor.shutdown).toHaveBeenCalledTimes(1);
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
