import { resolve } from 'node:path';
import { ipcMain } from 'electron';
import type { GrailDatabase } from '../database/database';
import type { BroadcastToRenderers } from '../ipc/broadcast';
import { createIpcMainRegistry } from '../ipc/handle';
import type { EventBus } from '../services/EventBus';
import { inspectSaveDirectory } from '../services/saveDirectoryInspector';
import type { D2SaveFile, SaveFileEvent, SaveFileMonitor } from '../services/saveFileMonitor';
import { resolveEffectiveSaveDirectory } from '../services/saveFileMonitor/saveDirectorySettings';
import type { SettingsService } from '../services/settingsService';
import type { ItemDetectionEvent, SaveDirectoryInspection } from '../types/grail';

/** Dependencies of the save file IPC handlers. */
export interface SaveFileHandlerDependencies {
  database: GrailDatabase;
  settings: SettingsService;
  eventBus: EventBus;
  saveFileMonitor: SaveFileMonitor;
  broadcastToRenderers: BroadcastToRenderers;
}

/**
 * Normalizes a directory path for equality comparison.
 * @param directory - Directory path to normalize
 * @returns Resolved path (case-insensitive on Windows)
 */
function normalizeDirectoryForComparison(directory: string): string {
  const resolved = resolve(directory.trim());
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/**
 * Gets the save directory whose data is currently stored in the database: the effective save
 * directory resolved from the stored setting (see `resolveEffectiveSaveDirectory`).
 * @returns The current effective save directory, or undefined if unknown
 */
function getCurrentSaveDirectory({
  settings,
  saveFileMonitor,
}: SaveFileHandlerDependencies): string | undefined {
  return resolveEffectiveSaveDirectory(
    settings.get('saveDir'),
    saveFileMonitor.getDefaultDirectory(),
  );
}

/**
 * Truncates user data only when the directory is known to have changed,
 * then persists the new save directory and restarts save file monitoring.
 * The truncate and the setting write share one transaction, so a failure of either
 * leaves the setting, the data and the monitor on the old directory.
 * Fails safe: if the current directory cannot be determined, user data is kept.
 * @param newDirectory - The validated new save directory
 */
async function applySaveDirectoryChange(
  deps: SaveFileHandlerDependencies,
  newDirectory: string,
): Promise<void> {
  const { database, settings, saveFileMonitor } = deps;
  const currentDirectory = getCurrentSaveDirectory(deps);
  let directoryChanged = false;
  if (currentDirectory) {
    directoryChanged =
      normalizeDirectoryForComparison(currentDirectory) !==
      normalizeDirectoryForComparison(newDirectory);
  } else {
    console.warn(
      '[applySaveDirectoryChange] Current save directory is unknown; keeping existing user data',
    );
  }

  // Only truncate user data when switching away from a known, different directory;
  // the new directory is saved in the same transaction as the truncate
  if (directoryChanged) {
    database.truncateUserData(newDirectory);
  } else {
    settings.set('saveDir', newDirectory);
  }

  // Update the monitor's directories and restart if needed
  await saveFileMonitor.updateSaveDirectory();
}

/**
 * Initializes IPC handlers for save file monitoring and forwards save file, item detection and
 * monitoring events to renderer processes. Detection and the automatic monitoring start live in
 * the GrailDetectionPipeline service.
 * @param deps - The services the handlers use
 * @returns Function that removes the handlers and event listeners
 */
export function initializeSaveFileHandlers(deps: SaveFileHandlerDependencies): () => void {
  const { eventBus, saveFileMonitor, broadcastToRenderers } = deps;
  const { handle, dispose } = createIpcMainRegistry(ipcMain);
  const eventUnsubscribers: Array<() => void> = [dispose];

  // Forward save file events to renderer processes
  const unsubscribeSaveFileEvent = eventBus.on('save-file-event', (event: SaveFileEvent) => {
    // The parsed items stay in the main process; renderers only need the file header.
    const { parsedItems: _parsedItems, ...rendererEvent } = event;
    broadcastToRenderers('save-file-event', rendererEvent);
  });
  eventUnsubscribers.push(unsubscribeSaveFileEvent);

  // Forward item detection events to renderer processes
  const unsubscribeItemDetection = eventBus.on('item-detection', (event: ItemDetectionEvent) => {
    broadcastToRenderers('item-detection-event', event);
  });
  eventUnsubscribers.push(unsubscribeItemDetection);

  const unsubscribeMonitoringStarted = eventBus.on('monitoring-started', (data) => {
    console.log(
      `Save file monitoring started for directory: ${data.directory} - Found ${data.saveFileCount} save files`,
    );
    broadcastToRenderers('monitoring-status-changed', {
      status: 'started',
      directory: data.directory,
      saveFileCount: data.saveFileCount,
    });
  });
  eventUnsubscribers.push(unsubscribeMonitoringStarted);

  const unsubscribeMonitoringStopped = eventBus.on('monitoring-stopped', () => {
    console.log('Save file monitoring stopped');
    broadcastToRenderers('monitoring-status-changed', { status: 'stopped' });
  });
  eventUnsubscribers.push(unsubscribeMonitoringStopped);

  const unsubscribeMonitoringError = eventBus.on('monitoring-error', (error) => {
    broadcastToRenderers('monitoring-status-changed', {
      status: 'error',
      error: error.message,
      errorType: error.type,
      directory: error.directory,
      saveFileCount: error.saveFileCount || 0,
    });
  });
  eventUnsubscribers.push(unsubscribeMonitoringError);

  /**
   * IPC handler for starting save file monitoring (e.g. when leaving Manual mode).
   * Starting while already monitoring is a no-op in the monitor service.
   */
  handle('saveFile:startMonitoring', async (): Promise<{ success: boolean }> => {
    await saveFileMonitor.startMonitoring();
    return { success: true };
  });

  /**
   * IPC handler for stopping save file monitoring (e.g. when switching to Manual mode).
   */
  handle('saveFile:stopMonitoring', async (): Promise<{ success: boolean }> => {
    await saveFileMonitor.stopMonitoring();
    return { success: true };
  });

  /**
   * IPC handler for retrieving all save files.
   * @returns Promise resolving to array of save file data
   */
  handle('saveFile:getSaveFiles', async (): Promise<D2SaveFile[]> => {
    return await saveFileMonitor.getSaveFiles();
  });

  /**
   * IPC handler for getting the current monitoring status.
   * @returns Object containing monitoring status and directory information
   */
  handle('saveFile:getMonitoringStatus', async () => {
    return {
      isMonitoring: saveFileMonitor.isCurrentlyMonitoring(),
      directory: saveFileMonitor.getSaveDirectory(),
    };
  });

  /**
   * IPC handler for getting the platform default save directory.
   * @returns The platform-specific default save directory path
   */
  handle('saveFile:getDefaultDirectory', async (): Promise<string> => {
    return saveFileMonitor.getDefaultDirectory();
  });

  /**
   * IPC handler for updating the save directory.
   * Updates database settings, truncates user data if the directory actually changed,
   * and restarts monitoring.
   * @param _ - IPC event (unused)
   * @param saveDir - New save directory path
   */
  handle('saveFile:updateSaveDirectory', async (_, saveDir) => {
    // The validator trimmed the path and checked that it is absolute
    await applySaveDirectoryChange(deps, saveDir);

    return { success: true };
  });

  /**
   * IPC handler for inspecting a candidate save directory without applying it.
   * Used by the setup wizard to validate typed/pasted paths and to suggest the
   * actual D2R save folder when the user picked its parent or a subfolder.
   * @param _ - IPC event (unused)
   * @param directory - Candidate directory path
   * @returns The inspection result
   */
  handle(
    'saveFile:inspectDirectory',
    async (_, directory): Promise<SaveDirectoryInspection> => inspectSaveDirectory(directory),
  );

  /**
   * IPC handler for restoring the default save directory.
   * Gets platform-specific default directory and updates settings accordingly.
   * User data is only truncated if the default differs from the current directory.
   */
  handle('saveFile:restoreDefaultDirectory', async () => {
    // Get the platform default directory
    const defaultDirectory = saveFileMonitor.getDefaultDirectory();

    await applySaveDirectoryChange(deps, defaultDirectory);

    return { success: true, defaultDirectory };
  });

  /**
   * IPC handler for retrieving available runes from the most recent save file scan.
   * Returns a map of rune IDs to their counts from current inventory/stash.
   * @returns Promise resolving to record of rune IDs mapped to their counts
   */
  handle('saveFile:getAvailableRunes', async (): Promise<Record<string, number>> => {
    return saveFileMonitor.getAvailableRunesCount();
  });

  /**
   * IPC handler for triggering a manual refresh/rescan of all save files.
   * Forces a re-parse of all save files to get the latest item data.
   * @returns Promise resolving when the refresh is complete
   */
  handle('saveFile:refreshSaveFiles', async (): Promise<{ success: boolean }> => {
    await saveFileMonitor.refreshSaveFiles();
    return { success: true };
  });

  console.log('Save file IPC handlers initialized');

  return () => {
    for (const unsubscribe of eventUnsubscribers) {
      unsubscribe();
    }
  };
}
