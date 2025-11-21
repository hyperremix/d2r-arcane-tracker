import { ipcMain, webContents } from 'electron';
import type { GrailDatabase } from '../database/database';
import { grailDatabase } from '../database/database';
import { DatabaseBatchWriter } from '../services/DatabaseBatchWriter';
import { EventBus } from '../services/EventBus';
import { ItemDetectionService } from '../services/itemDetection';
import { MemoryReader } from '../services/memoryReader';
import { ProcessMonitor } from '../services/processMonitor';
import { RunTrackerService } from '../services/runTracker';
import type { D2SaveFile, SaveFileEvent } from '../services/saveFileMonitor';
import { SaveFileMonitor } from '../services/saveFileMonitor';
import type {
  Character,
  CharacterClass,
  GrailProgress,
  Item,
  ItemDetectionEvent,
  RunItem,
} from '../types/grail';

/**
 * Global service instances for save file monitoring and item detection.
 */
export const eventBus = new EventBus();
const batchWriter = new DatabaseBatchWriter(grailDatabase, () => {
  // Emit grail-progress-updated event to all renderer windows after batch flush
  const allWebContents = webContents.getAllWebContents();
  for (const wc of allWebContents) {
    if (!wc.isDestroyed() && wc.getType() === 'window') {
      wc.send('grail-progress-updated');
    }
  }
});
let saveFileMonitor: SaveFileMonitor;
let itemDetectionService: ItemDetectionService;
let runTracker: RunTrackerService | undefined;
let processMonitor: ProcessMonitor | undefined;
let memoryReader: MemoryReader | undefined;
const eventUnsubscribers: Array<() => void> = [];

/**
 * Finds or creates a character by name.
 * @param characterName - Name of the character to find or create
 * @param level - Level of the character (used when creating new character)
 * @param characterClass - Optional character class to use when creating new character
 * @returns Character object or null if creation fails
 */
function findOrCreateCharacter(
  characterName: string,
  level: number,
  database: GrailDatabase,
  writer: DatabaseBatchWriter,
  characterClass?: CharacterClass,
) {
  let character = database.getCharacterByName(characterName);

  if (!character) {
    const characterId = `char_${characterName}_${Date.now()}`;
    // Determine if this is a shared stash based on the character name
    const isSharedStash =
      characterName === 'Shared Stash Softcore' || characterName === 'Shared Stash Hardcore';
    const defaultCharacterClass = isSharedStash ? 'shared_stash' : characterClass || 'barbarian';

    character = {
      id: characterId,
      name: characterName,
      characterClass: defaultCharacterClass, // Use shared_stash for shared stash files, will be updated from save file data for regular characters
      level: level || 1,
      hardcore: characterName === 'Shared Stash Hardcore',
      expansion: true,
      saveFilePath: undefined,
      lastUpdated: new Date(),
      created: new Date(),
    };

    // Queue character creation for batch write
    writer.queueCharacter(character);
    console.log(`Queued new character for batch write: ${characterName}`);
  }

  return character;
}

/**
 * Creates a grail progress entry for a character and item.
 * @param character - Character who found the item
 * @param event - Item detection event
 * @returns Grail progress object
 */
function createGrailProgress(character: Character, event: ItemDetectionEvent): GrailProgress {
  // Use d2s item ID if available, otherwise fall back to timestamp for backward compatibility
  const itemIdentifier = event.d2sItemId ? String(event.d2sItemId) : `timestamp_${Date.now()}`;
  const progressId = `${character.id}_${event.grailItem.id}_${itemIdentifier}`;
  return {
    id: progressId,
    characterId: character.id,
    itemId: event.grailItem.id,
    isEthereal: Boolean(event.item.ethereal),
    foundDate: new Date(),
    manuallyAdded: false,
    notes: `Auto-detected from ${event.item.location}`,
    fromInitialScan: event.isInitialScan ?? false,
  };
}

function findMatchingProgressForCharacter(
  existingProgress: GrailProgress[] | undefined,
  targetProgress: GrailProgress,
): GrailProgress | undefined {
  if (!existingProgress?.length) {
    return undefined;
  }

  return existingProgress.find(
    (progress) =>
      progress.characterId === targetProgress.characterId &&
      Boolean(progress.isEthereal) === Boolean(targetProgress.isEthereal),
  );
}

/**
 * Emits grail progress update event to all renderer processes.
 * @param character - Character who found the item
 * @param event - Item detection event
 * @param grailProgress - Grail progress object
 */
function emitGrailProgressUpdate(
  character: Character,
  event: ItemDetectionEvent,
  grailProgress: GrailProgress,
): void {
  const allWebContents = webContents.getAllWebContents();
  for (const wc of allWebContents) {
    if (!wc.isDestroyed()) {
      wc.send('grail-progress-updated', {
        character: character,
        item: event.item,
        progress: grailProgress,
        autoDetected: true,
        firstTimeDiscovery: true,
      });
    }
  }
}

export type HandleAutomaticGrailProgressDependencies = {
  database?: GrailDatabase;
  batchWriter?: DatabaseBatchWriter;
  eventBus?: EventBus;
  runTracker?: RunTrackerService;
};

/**
 * Handles automatic grail progress updates when items are detected.
 * Creates or updates character information and grail progress entries.
 * Emits events to renderer processes for first-time global discoveries.
 * @param event - Item detection event containing the found item
 * @param dependencies - Optional dependency overrides (for testing)
 */
export function handleAutomaticGrailProgress(
  event: ItemDetectionEvent,
  dependencies: HandleAutomaticGrailProgressDependencies = {},
): void {
  const currentDatabase = dependencies.database ?? grailDatabase;
  const currentBatchWriter = dependencies.batchWriter ?? batchWriter;
  const currentEventBus = dependencies.eventBus ?? eventBus;
  const currentRunTracker = dependencies.runTracker ?? runTracker;

  try {
    if (!event.item) return;

    const characterName = event.item.characterName;
    const character = findOrCreateCharacter(
      characterName,
      event.item.level,
      currentDatabase,
      currentBatchWriter,
      event.item.characterClass,
    );

    if (!character) {
      console.error('Failed to create or find character:', characterName);
      return;
    }

    // Check if this is a first-time global discovery
    const existingGlobalProgress = currentDatabase.getProgressByItem(event.grailItem.id);
    const isFirstTimeDiscovery = !existingGlobalProgress;

    // Create grail progress entry and queue for batch write
    const grailProgress = createGrailProgress(character, event);
    currentBatchWriter.queueProgress(grailProgress);
    const matchingPersistedProgress = findMatchingProgressForCharacter(
      existingGlobalProgress,
      grailProgress,
    );

    // Check for active run and associate item if found
    try {
      const activeRun = currentRunTracker?.getActiveRun();
      if (activeRun && !event.silent) {
        const runItem: RunItem = {
          id: `run_item_${activeRun.id}_${grailProgress.id}`,
          runId: activeRun.id,
          grailProgressId: matchingPersistedProgress?.id ?? grailProgress.id,
          foundTime: new Date(),
          created: new Date(),
        };

        // Queue run item for batch write (will be flushed with progress)
        // This ensures correct order: Progress -> RunItem
        currentBatchWriter.queueRunItem(runItem);

        // Emit event for UI updates
        currentEventBus.emit('run-item-added', {
          runId: activeRun.id,
          grailProgress,
          item: event.item,
        });
      }
    } catch (runAssociationError) {
      console.error('Error associating item with run:', runAssociationError);
      // Don't throw - grail progress is already saved, run association is secondary
    }

    // Flush the batch writer to ensure items are persisted before UI updates
    // This is critical because the UI will query the database immediately
    currentBatchWriter.flush();

    // Log and notify about the discovery (synchronous - don't delay user feedback)
    if (isFirstTimeDiscovery) {
      console.log(`🎉 NEW GRAIL ITEM: ${event.item.name} found by ${characterName}`);
      // Only emit grail update notifications for non-silent events
      // Silent events still save to database but don't trigger user notifications
      // This prevents notification spam during initial parsing and force re-scans
      if (!event.silent) {
        emitGrailProgressUpdate(character, event, grailProgress);
      }
    }
  } catch (error) {
    console.error('Error handling automatic grail progress:', error);
  }
}

/**
 * Updates character information from save file data.
 * Creates new character if not found, or updates existing character with latest save file data.
 * @param saveFile - Save file data containing character information
 */
function updateCharacterFromSaveFile(saveFile: D2SaveFile): void {
  try {
    const character =
      grailDatabase.getCharacterBySaveFilePath(saveFile.path) ||
      grailDatabase.getCharacterByName(saveFile.name);

    if (character) {
      // Update existing character - queue for batch write
      const updatedCharacter: Character = {
        ...character,
        characterClass: saveFile.characterClass as CharacterClass,
        level: saveFile.level,
        hardcore: saveFile.hardcore,
        expansion: saveFile.expansion,
        saveFilePath: saveFile.path,
        lastUpdated: new Date(),
      };
      batchWriter.queueCharacter(updatedCharacter);
    } else {
      // Create new character - queue for batch write
      const characterId = `char_${saveFile.name}_${Date.now()}`;

      const newCharacter: Character = {
        id: characterId,
        name: saveFile.name,
        characterClass: saveFile.characterClass as CharacterClass,
        level: saveFile.level,
        hardcore: saveFile.hardcore,
        expansion: saveFile.expansion,
        saveFilePath: saveFile.path,
        lastUpdated: new Date(),
        created: new Date(),
      };

      batchWriter.queueCharacter(newCharacter);
      console.log(
        `Queued character for batch write: ${saveFile.name} (${saveFile.characterClass})`,
      );
    }
  } catch (error) {
    console.error('Error updating character from save file:', error);
  }
}

/**
 * Initializes Windows-specific services (process monitor and memory reader).
 * @private
 */
function initializeWindowsServices(): void {
  if (process.platform !== 'win32') {
    return;
  }

  // Initialize process monitor
  try {
    processMonitor = new ProcessMonitor(eventBus);
    processMonitor.startMonitoring();
  } catch (error) {
    console.error('[initializeSaveFileHandlers] Failed to initialize process monitor:', error);
    processMonitor = undefined;
    return;
  }

  // Initialize memory reader (optional, depends on process monitor)
  if (processMonitor) {
    try {
      memoryReader = new MemoryReader(eventBus, processMonitor);
    } catch (error) {
      console.error('[initializeSaveFileHandlers] Failed to initialize memory reader:', error);
      memoryReader = undefined;
    }
  }
}

/**
 * Initializes IPC handlers for save file monitoring and item detection.
 * Sets up event listeners for save file changes and item detection.
 * Configures automatic grail progress updates and forwards events to renderer processes.
 * Loads grail items into the detection service and starts monitoring automatically.
 */
export function initializeSaveFileHandlers(): void {
  console.log('[initializeSaveFileHandlers] Starting initialization');
  console.log('[initializeSaveFileHandlers] Current EventBus listener counts:', {
    'save-file-event': eventBus.listenerCount('save-file-event'),
    'item-detection': eventBus.listenerCount('item-detection'),
  });

  // Clean up any existing handlers before re-initialization (important for hot-reload scenarios)
  if (eventUnsubscribers.length > 0) {
    console.log(
      `[initializeSaveFileHandlers] Cleaning up ${eventUnsubscribers.length} existing event handlers`,
    );
    for (const unsubscribe of eventUnsubscribers) {
      unsubscribe();
    }
    eventUnsubscribers.length = 0;
  }

  // Initialize Windows-specific services
  initializeWindowsServices();

  // Initialize run tracker service with optional memory reader
  try {
    runTracker = new RunTrackerService(eventBus, grailDatabase, memoryReader || null);

    // If memory reader was created after run tracker, set it now
    if (memoryReader && runTracker) {
      runTracker.setMemoryReader(memoryReader);
    }
  } catch (error) {
    console.error('[initializeSaveFileHandlers] Failed to initialize run tracker:', error);
    runTracker = undefined;
  }

  // Initialize monitor and detection service with EventBus and grail database
  saveFileMonitor = new SaveFileMonitor(eventBus, grailDatabase);
  itemDetectionService = new ItemDetectionService(eventBus);

  // Set up event forwarding to renderer process
  const unsubscribeSaveFileEvent = eventBus.on('save-file-event', async (event: SaveFileEvent) => {
    // Forward save file events to renderer processes
    // Filter to only 'window' type to exclude DevTools, background pages, etc.
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed() && wc.getType() === 'window') {
        wc.send('save-file-event', event);
      }
    }

    // Update character information from save file
    updateCharacterFromSaveFile(event.file);

    // Analyze save file for item changes if it's a modification
    // Await to ensure sequential processing and prevent race conditions
    if (event.type === 'modified') {
      await itemDetectionService.analyzeSaveFile(
        event.file,
        event.extractedItems,
        event.silent,
        event.isInitialScan,
      );
    }
  });
  eventUnsubscribers.push(unsubscribeSaveFileEvent);

  // Set up item detection event forwarding and automatic grail progress updates
  const unsubscribeItemDetection = eventBus.on('item-detection', (event: ItemDetectionEvent) => {
    // Forward event to renderer processes
    // Filter to only 'window' type to exclude DevTools, background pages, etc.
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed() && wc.getType() === 'window') {
        wc.send('item-detection-event', event);
      }
    }

    // Handle automatic grail progress updates for found items
    if (event.type === 'item-found' && event.item) {
      handleAutomaticGrailProgress(event);
    }
  });
  eventUnsubscribers.push(unsubscribeItemDetection);

  const unsubscribeMonitoringStarted = eventBus.on('monitoring-started', (data) => {
    console.log(
      `Save file monitoring started for directory: ${data.directory} - Found ${data.saveFileCount} save files`,
    );
    // Filter to only 'window' type to exclude DevTools, background pages, etc.
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed() && wc.getType() === 'window') {
        wc.send('monitoring-status-changed', {
          status: 'started',
          directory: data.directory,
          saveFileCount: data.saveFileCount,
        });
      }
    }
  });
  eventUnsubscribers.push(unsubscribeMonitoringStarted);

  const unsubscribeMonitoringStopped = eventBus.on('monitoring-stopped', () => {
    console.log('Save file monitoring stopped');
    // Filter to only 'window' type to exclude DevTools, background pages, etc.
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed() && wc.getType() === 'window') {
        wc.send('monitoring-status-changed', { status: 'stopped' });
      }
    }
  });
  eventUnsubscribers.push(unsubscribeMonitoringStopped);

  const unsubscribeMonitoringError = eventBus.on('monitoring-error', (error) => {
    // Filter to only 'window' type to exclude DevTools, background pages, etc.
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed() && wc.getType() === 'window') {
        wc.send('monitoring-status-changed', {
          status: 'error',
          error: error.message,
          errorType: error.type,
          directory: error.directory,
          saveFileCount: error.saveFileCount || 0,
        });
      }
    }
  });
  eventUnsubscribers.push(unsubscribeMonitoringError);

  // Load grail items into item detection service
  try {
    const grailItems: Item[] = grailDatabase.getAllItems();
    itemDetectionService.setGrailItems(grailItems);
    console.log(`Loaded ${grailItems.length} grail items into detection service`);

    // Initialize with existing progress to prevent re-notification
    const grailProgress = grailDatabase.getAllProgress();
    itemDetectionService.initializeFromDatabase(grailProgress);
  } catch (error) {
    console.error('Failed to load grail items into detection service:', error);
  }

  // Automatically start monitoring
  setTimeout(async () => {
    try {
      await saveFileMonitor.startMonitoring();
    } catch (error) {
      console.error('Failed to auto-start save file monitoring:', error);
    }
  }, 1000); // Short delay to ensure everything is initialized

  // IPC handlers for status and file retrieval only

  /**
   * IPC handler for retrieving all save files.
   * @returns Promise resolving to array of save file data
   */
  ipcMain.handle('saveFile:getSaveFiles', async (): Promise<D2SaveFile[]> => {
    try {
      return await saveFileMonitor.getSaveFiles();
    } catch (error) {
      console.error('Failed to get save files:', error);
      throw error;
    }
  });

  /**
   * IPC handler for getting the current monitoring status.
   * @returns Object containing monitoring status and directory information
   */
  ipcMain.handle('saveFile:getMonitoringStatus', async () => {
    try {
      return {
        isMonitoring: saveFileMonitor.isCurrentlyMonitoring(),
        directory: saveFileMonitor.getSaveDirectory(),
      };
    } catch (error) {
      console.error('Failed to get monitoring status:', error);
      throw error;
    }
  });

  /**
   * IPC handler for updating the save directory.
   * Updates database settings, truncates user data, and restarts monitoring.
   * @param _ - IPC event (unused)
   * @param saveDir - New save directory path
   */
  ipcMain.handle('saveFile:updateSaveDirectory', async (_, saveDir: string) => {
    try {
      // Update the database setting
      grailDatabase.setSetting('saveDir', saveDir);

      // Truncate user data before changing directory
      grailDatabase.truncateUserData();

      // Update the monitor's directories and restart if needed
      await saveFileMonitor.updateSaveDirectory();

      return { success: true };
    } catch (error) {
      console.error('Failed to update save directory:', error);
      throw error;
    }
  });

  /**
   * IPC handler for restoring the default save directory.
   * Gets platform-specific default directory and updates settings accordingly.
   */
  ipcMain.handle('saveFile:restoreDefaultDirectory', async () => {
    try {
      // Get the platform default directory
      const defaultDirectory = saveFileMonitor.getDefaultDirectory();

      // Update the database setting to the default
      grailDatabase.setSetting('saveDir', defaultDirectory);

      // Truncate user data before changing directory
      grailDatabase.truncateUserData();

      // Update the monitor's directories and restart if needed
      await saveFileMonitor.updateSaveDirectory();

      return { success: true, defaultDirectory };
    } catch (error) {
      console.error('Failed to restore default directory:', error);
      throw error;
    }
  });

  /**
   * IPC handler for retrieving available runes from the most recent save file scan.
   * Returns a map of rune IDs to their counts from current inventory/stash.
   * @returns Promise resolving to record of rune IDs mapped to their counts
   */
  ipcMain.handle('saveFile:getAvailableRunes', async (): Promise<Record<string, number>> => {
    try {
      return saveFileMonitor.getAvailableRunesCount();
    } catch (error) {
      console.error('Failed to get available runes:', error);
      throw error;
    }
  });

  /**
   * IPC handler for triggering a manual refresh/rescan of all save files.
   * Forces a re-parse of all save files to get the latest item data.
   * @returns Promise resolving when the refresh is complete
   */
  ipcMain.handle('saveFile:refreshSaveFiles', async (): Promise<{ success: boolean }> => {
    try {
      await saveFileMonitor.refreshSaveFiles();
      return { success: true };
    } catch (error) {
      console.error('Failed to refresh save files:', error);
      throw error;
    }
  });

  console.log('Save file IPC handlers initialized');
}

/**
 * Closes the save file monitor and stops monitoring.
 * Should be called when the application is shutting down to properly clean up resources.
 */
/**
 * Gets the run tracker instance.
 */
export function getRunTracker(): RunTrackerService | undefined {
  return runTracker;
}

export function closeSaveFileMonitor(): void {
  // Flush any pending database writes before shutdown
  console.log('[closeSaveFileMonitor] Flushing pending database writes');
  batchWriter.flush();

  // Unsubscribe all event listeners
  for (const unsubscribe of eventUnsubscribers) {
    unsubscribe();
  }
  eventUnsubscribers.length = 0;

  // Clear all event bus listeners
  eventBus.clear();

  // Stop save file monitoring
  if (saveFileMonitor) {
    saveFileMonitor.stopMonitoring();
  }
}
