import path from 'node:path';
import { app, BrowserWindow, webContents } from 'electron';
import { GrailDatabase } from '../database/database';
import { createRendererBroadcaster } from '../ipc/broadcast';
import { initializeAppWindowHandlers } from '../ipc-handlers/appWindowHandlers';
import { initializeDialogHandlers } from '../ipc-handlers/dialogHandlers';
import { initializeGlobalHotkeyHandlers } from '../ipc-handlers/globalHotkeyHandlers';
import { initializeGrailHandlers } from '../ipc-handlers/grailHandlers';
import { initializeIconHandlers } from '../ipc-handlers/iconHandlers';
import { initializeInventoryWindowHandlers } from '../ipc-handlers/inventoryWindowHandlers';
import { initializeRunTrackerHandlers } from '../ipc-handlers/runTrackerHandlers';
import { initializeSaveFileHandlers } from '../ipc-handlers/saveFileHandlers';
import { initializeShellHandlers } from '../ipc-handlers/shellHandlers';
import { initializeTerrorZoneHandlers } from '../ipc-handlers/terrorZoneHandlers';
import { initializeUpdateHandlers } from '../ipc-handlers/updateHandlers';
import { initializeVaultHandlers } from '../ipc-handlers/vaultHandlers';
import { initializeWidgetHandlers } from '../ipc-handlers/widgetHandlers';
import { EventBus } from '../services/EventBus';
import { createGameProcessGuard } from '../services/gameProcessGuard';
import { GlobalHotkeyService } from '../services/globalHotkeys';
import {
  GrailProgressService,
  loadGrailItemsIntoDetection,
} from '../services/grailProgressService';
import { IconService } from '../services/iconService';
import { ItemDetectionService } from '../services/itemDetection';
import { MemoryReader } from '../services/memoryReader';
import { ProcessMonitor } from '../services/processMonitor';
import { RunTrackerService } from '../services/runTracker';
import { configureSaveFileBackups } from '../services/saveFileBackup';
import * as saveFileEditor from '../services/saveFileEditor';
import { SaveFileMonitor } from '../services/saveFileMonitor';
import { SettingsService } from '../services/settingsService';
import { TerrorZoneService } from '../services/terrorZoneService';
import { UpdateService } from '../services/updateService';
import { VaultService } from '../services/vaultService';
import { setErrorForwarder } from '../utils/serviceLogger';
import { getWidgetSizeSettingKey } from '../utils/widgetDisplay';
import { createMainWindow, getMainWindow } from '../window/mainWindow';
import { createDebouncedWidgetSizeSaver, showWidgetWindow } from '../window/widgetWindow';
import { AppLifecycle, closeWindowAndWait } from './lifecycle';
import type { AppPaths } from './paths';

/** The running application. */
export interface RunningApp {
  /** Opens the main window again (macOS re-activation). */
  createMainWindow: () => void;
  /**
   * Stops everything in reverse start order: global hotkeys, run tracker (ends the open run and
   * session), save file monitoring, windows (save their bounds) and the database last.
   * @returns Promise that resolves when the app has stopped; it never rejects
   */
  shutdown: () => Promise<void>;
}

/**
 * Starts the process monitor and the memory reader, which only work on Windows. The Win32 memory
 * bindings are imported here, so other platforms never load them.
 * @param eventBus - Event bus the services publish on
 * @returns The started services; undefined when unsupported or when they failed to start
 */
async function startWindowsServices(eventBus: EventBus): Promise<{
  processMonitor?: ProcessMonitor;
  memoryReader?: MemoryReader;
}> {
  if (process.platform !== 'win32') {
    return {};
  }

  // Loaded before the process monitor starts, so the memory reader subscribes before the first
  // d2r-started event
  let processMemory: typeof import('../services/win32/processMemory') | undefined;
  try {
    processMemory = await import('../services/win32/processMemory');
  } catch (error) {
    console.error('[bootstrap] Failed to load the Win32 memory bindings:', error);
  }

  let processMonitor: ProcessMonitor;
  try {
    processMonitor = new ProcessMonitor(eventBus);
    processMonitor.startMonitoring();
  } catch (error) {
    console.error('[bootstrap] Failed to initialize process monitor:', error);
    return {};
  }

  if (!processMemory) {
    return { processMonitor };
  }

  try {
    return {
      processMonitor,
      memoryReader: new MemoryReader(eventBus, new processMemory.WindowsMemoryReaderImpl()),
    };
  } catch (error) {
    console.error('[bootstrap] Failed to initialize memory reader:', error);
    return { processMonitor };
  }
}

/**
 * Constructs every main-process service once, in dependency order, registers the IPC handlers with
 * the services they need and opens the windows. Must be called once the app is ready.
 * If a step fails, everything that was started is stopped again (in reverse start order, as on
 * quit) before the error is rethrown, so a failed start leaves no open database or running monitor.
 * @param paths - Locations of the bundled app
 * @returns The running app
 */
export async function startApp(paths: AppPaths): Promise<RunningApp> {
  // Every started part registers its teardown; shutdown runs them in reverse order
  const lifecycle = new AppLifecycle();
  try {
    return await startServices(paths, lifecycle);
  } catch (error) {
    await lifecycle.shutdown();
    throw error;
  }
}

async function startServices(paths: AppPaths, lifecycle: AppLifecycle): Promise<RunningApp> {
  const broadcastToRenderers = createRendererBroadcaster(() => webContents.getAllWebContents());

  // Forward service errors to the renderers
  setErrorForwarder((payload) => {
    try {
      broadcastToRenderers('service-error', payload);
    } catch {
      // Forwarding must never break logging
    }
  });

  // Keep a copy of every save file before the vault/inventory editor modifies it
  configureSaveFileBackups(path.join(app.getPath('userData'), 'save-file-backups'));

  // Services, in dependency order
  const database = new GrailDatabase();
  lifecycle.onShutdown('database', () => database.close());

  // Debounce widget size changes to avoid excessive database writes during resize. A size can only
  // be pending once the widget exists, which is after the settings service below.
  const widgetSizeSaver = createDebouncedWidgetSizeSaver((display, size) =>
    settings.set(getWidgetSizeSettingKey(display), size),
  );

  // Windows are closed while the database is still open: closing saves their bounds
  lifecycle.onShutdown('windows', async () => {
    widgetSizeSaver.flush();
    await Promise.all(BrowserWindow.getAllWindows().map((window) => closeWindowAndWait(window)));
  });

  const eventBus = new EventBus();
  lifecycle.onShutdown('event bus', () => eventBus.clear());

  // Every settings write goes through the settings service, which announces it on the event bus
  const settings = new SettingsService(database, eventBus);

  const { processMonitor, memoryReader } = await startWindowsServices(eventBus);
  lifecycle.onShutdown('process monitor', () => processMonitor?.shutdown());
  lifecycle.onShutdown('memory reader', () => memoryReader?.shutdown());

  const saveFileMonitor = new SaveFileMonitor(eventBus, database);
  lifecycle.onShutdown('save file monitor', () => saveFileMonitor.shutdown());
  saveFileMonitor.start();

  const itemDetection = new ItemDetectionService(eventBus);

  // Ends the open run and session, which writes to the database
  const runTracker = new RunTrackerService(eventBus, database, memoryReader);
  lifecycle.onShutdown('run tracker', () => runTracker.shutdown());

  const grailProgress = new GrailProgressService({
    database,
    eventBus,
    runTracker,
    broadcastToRenderers,
  });

  const vault = new VaultService({
    database,
    saveFileEditor,
    // Save files must not be edited while the game runs; uses the process monitor's state
    assertGameNotRunning: createGameProcessGuard({ processMonitor }),
    getMonitoredSaveDirectory: () => saveFileMonitor.getSaveDirectory() ?? undefined,
    getConfiguredSaveDirectory: () => settings.get('saveDir'),
    getInventorySnapshots: () => saveFileMonitor.getInventorySearchResult().snapshots,
  });
  const hotkeys = new GlobalHotkeyService({
    getSettings: () => settings.getAll(),
    getRunTracker: () => runTracker,
    isAppFocused: () => {
      const mainWindow = getMainWindow();
      return Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused());
    },
    onStatusChange: (status) => broadcastToRenderers('run-tracker:global-hotkey-status', status),
  });
  const iconService = new IconService();
  const terrorZoneService = new TerrorZoneService();
  const updateService = new UpdateService();
  lifecycle.onShutdown('update service', () => updateService.dispose());

  // Widget window persistence
  const onWidgetPositionChange = (position: { x: number; y: number }) => {
    try {
      settings.set('widgetPosition', position);
    } catch (error) {
      console.error('Failed to save widget position:', error);
    }
  };

  // IPC handlers (each returns the teardown that unregisters it)
  lifecycle.onShutdown(
    'grail handlers',
    initializeGrailHandlers({ database, settings, broadcastToRenderers }),
  );
  const disposeSaveFileHandlers = initializeSaveFileHandlers({
    database,
    settings,
    eventBus,
    saveFileMonitor,
    itemDetection,
    grailProgress,
    broadcastToRenderers,
  });
  lifecycle.onShutdown('save file handlers', disposeSaveFileHandlers);
  lifecycle.onShutdown('vault handlers', initializeVaultHandlers(vault));
  lifecycle.onShutdown(
    'run tracker handlers',
    initializeRunTrackerHandlers({
      runTracker,
      database,
      eventBus,
      broadcastToRenderers,
    }),
  );
  // Opt-in global hotkeys for the run tracker (work while D2R is focused). Released first on
  // shutdown so other applications can use the key combinations again.
  const disposeGlobalHotkeyHandlers = initializeGlobalHotkeyHandlers({
    hotkeys,
    onSettingsUpdated: (listener) => settings.onUpdated(listener),
  });
  lifecycle.onShutdown('global hotkeys', () => {
    disposeGlobalHotkeyHandlers();
    hotkeys.dispose();
  });
  lifecycle.onShutdown('dialog handlers', initializeDialogHandlers());
  lifecycle.onShutdown('shell handlers', initializeShellHandlers());
  lifecycle.onShutdown('icon handlers', initializeIconHandlers({ iconService, settings }));
  lifecycle.onShutdown(
    'inventory window handlers',
    initializeInventoryWindowHandlers(paths, () => saveFileMonitor.getSaveDirectory() ?? undefined),
  );
  lifecycle.onShutdown(
    'terror zone handlers',
    initializeTerrorZoneHandlers({ terrorZoneService, settings }),
  );
  lifecycle.onShutdown(
    'update handlers',
    initializeUpdateHandlers({ updateService, getMainWindow }),
  );
  lifecycle.onShutdown(
    'widget handlers',
    initializeWidgetHandlers(settings, paths, onWidgetPositionChange, widgetSizeSaver.save),
  );
  lifecycle.onShutdown(
    'app window handlers',
    initializeAppWindowHandlers({ getMainWindow, paths }),
  );

  loadGrailItemsIntoDetection(itemDetection, database);

  const openMainWindow = () => {
    createMainWindow({ settings, paths });
  };

  // Create main window
  openMainWindow();

  // Initialize widget window if enabled in settings
  try {
    const storedSettings = settings.getAll();
    if (storedSettings.widgetEnabled) {
      showWidgetWindow(storedSettings, paths, onWidgetPositionChange, widgetSizeSaver.save);
    }
  } catch (error) {
    console.error('Failed to initialize widget window:', error);
  }

  return { createMainWindow: openMainWindow, shutdown: () => lifecycle.shutdown() };
}
