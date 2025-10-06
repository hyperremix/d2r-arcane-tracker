import { ipcMain, webContents } from 'electron';
import { grailDatabase } from '../database/database';
import { ItemDetectionService } from '../services/itemDetection';
import type { D2SaveFile, SaveFileEvent } from '../services/saveFileMonitor';
import { SaveFileMonitor } from '../services/saveFileMonitor';
import type { CharacterClass, Item, ItemDetectionEvent } from '../types/grail';

/**
 * Global service instances for save file monitoring and item detection.
 */
let saveFileMonitor: SaveFileMonitor;
let itemDetectionService: ItemDetectionService;

/**
 * Handles automatic grail progress updates when items are detected.
 * Creates or updates character information and grail progress entries.
 * Emits events to renderer processes for first-time global discoveries.
 * @param event - Item detection event containing the found item
 */
function handleAutomaticGrailProgress(event: ItemDetectionEvent): void {
  try {
    if (!event.item) return;

    const characterName = event.item.characterName;

    // Find or create character in database
    let character = grailDatabase.getCharacterByName(characterName);

    if (!character) {
      // Create new character from item information
      const characterId = `char_${characterName}_${Date.now()}`;

      grailDatabase.upsertCharacter({
        id: characterId,
        name: characterName,
        characterClass: 'barbarian', // Default value, will be updated from save file data
        level: event.item.level || 1,
        difficulty: 'normal' as const,
        hardcore: false,
        expansion: true,
        saveFilePath: undefined,
        lastUpdated: new Date(),
        created: new Date(),
      });
      character = grailDatabase.getCharacterByName(characterName);
      console.log(`Created new character: ${characterName}`);
    }

    if (!character) {
      console.error('Failed to create or find character:', characterName);
      return;
    }

    // Check if this item has been found by ANY character (global check)
    const existingGlobalProgress = grailDatabase
      .getProgressByItem(event.grailItem.id)
      .find((p) => p.found);

    const isFirstTimeDiscovery = !existingGlobalProgress;

    // Create grail progress entry for this character
    const progressId = `progress_${character.id}_${event.grailItem.id}_${Date.now()}`;
    const grailProgress = {
      id: progressId,
      characterId: character.id,
      itemId: event.grailItem.id, // base ID
      found: true,
      isEthereal: Boolean(event.item.ethereal),
      foundDate: new Date(),
      manuallyAdded: false,
      difficulty: character.difficulty,
      notes: `Auto-detected from ${event.item.location}`,
    };

    grailDatabase.upsertProgress(grailProgress);

    if (isFirstTimeDiscovery) {
      console.log(`🎉 NEW GRAIL ITEM: ${event.item.name} found by ${characterName}`);

      // Only emit event for first-time global discoveries
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
    } else {
      console.log(
        `Character discovery: ${event.item.name} found by ${characterName} (already discovered globally)`,
      );
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
      // Update existing character
      grailDatabase.updateCharacter(character.id, {
        characterClass: saveFile.characterClass as CharacterClass,
        level: saveFile.level,
        difficulty: saveFile.difficulty,
        hardcore: saveFile.hardcore,
        expansion: saveFile.expansion,
        saveFilePath: saveFile.path,
      });
    } else {
      // Create new character
      const characterId = `char_${saveFile.name}_${Date.now()}`;

      grailDatabase.upsertCharacter({
        id: characterId,
        name: saveFile.name,
        characterClass: saveFile.characterClass as CharacterClass,
        level: saveFile.level,
        difficulty: saveFile.difficulty,
        hardcore: saveFile.hardcore,
        expansion: saveFile.expansion,
        saveFilePath: saveFile.path,
        lastUpdated: new Date(),
        created: new Date(),
      });
      console.log(
        `Created character from save file: ${saveFile.name} (${saveFile.characterClass})`,
      );
    }
  } catch (error) {
    console.error('Error updating character from save file:', error);
  }
}

/**
 * Initializes IPC handlers for save file monitoring and item detection.
 * Sets up event listeners for save file changes and item detection.
 * Configures automatic grail progress updates and forwards events to renderer processes.
 * Loads grail items into the detection service and starts monitoring automatically.
 */
export function initializeSaveFileHandlers(): void {
  // Initialize monitor and detection service with grail database
  saveFileMonitor = new SaveFileMonitor(grailDatabase);
  itemDetectionService = new ItemDetectionService();

  // Set up event forwarding to renderer process
  saveFileMonitor.on('save-file-event', (event: SaveFileEvent) => {
    // Forward save file events to all renderer processes
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed()) {
        wc.send('save-file-event', event);
      }
    }

    // Update character information from save file
    updateCharacterFromSaveFile(event.file);

    // Analyze save file for item changes if it's a modification
    if (event.type === 'modified') {
      itemDetectionService.analyzeSaveFile(event.file);
    }
  });

  // Set up item detection event forwarding and automatic grail progress updates
  itemDetectionService.on('item-detection', (event: ItemDetectionEvent) => {
    // Forward event to renderer processes
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed()) {
        wc.send('item-detection-event', event);
      }
    }

    // Handle automatic grail progress updates for found items
    if (event.type === 'item-found' && event.item) {
      handleAutomaticGrailProgress(event);
    }
  });

  saveFileMonitor.on('monitoring-started', (data: { directory: string; saveFileCount: number }) => {
    console.log(
      `Save file monitoring started for directory: ${data.directory} - Found ${data.saveFileCount} save files`,
    );
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed()) {
        wc.send('monitoring-status-changed', {
          status: 'started',
          directory: data.directory,
          saveFileCount: data.saveFileCount,
        });
      }
    }
  });

  saveFileMonitor.on('monitoring-stopped', () => {
    console.log('Save file monitoring stopped');
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed()) {
        wc.send('monitoring-status-changed', { status: 'stopped' });
      }
    }
  });

  saveFileMonitor.on(
    'monitoring-error',
    (error: {
      type: string;
      message: string;
      directory: string | null;
      saveFileCount?: number;
    }) => {
      const allWebContents = webContents.getAllWebContents();
      for (const wc of allWebContents) {
        if (!wc.isDestroyed()) {
          wc.send('monitoring-status-changed', {
            status: 'error',
            error: error.message,
            errorType: error.type,
            directory: error.directory,
            saveFileCount: error.saveFileCount || 0,
          });
        }
      }
    },
  );

  // Load grail items into item detection service
  try {
    const grailItems: Item[] = grailDatabase.getAllItems();
    itemDetectionService.setGrailItems(grailItems);
    console.log(`Loaded ${grailItems.length} grail items into detection service`);
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

  // Item detection handlers
  /**
   * IPC handler for enabling item detection.
   */
  ipcMain.handle('itemDetection:enable', async () => {
    try {
      itemDetectionService.enable();
      return { success: true };
    } catch (error) {
      console.error('Failed to enable item detection:', error);
      throw error;
    }
  });

  /**
   * IPC handler for disabling item detection.
   */
  ipcMain.handle('itemDetection:disable', async () => {
    try {
      itemDetectionService.disable();
      return { success: true };
    } catch (error) {
      console.error('Failed to disable item detection:', error);
      throw error;
    }
  });

  /**
   * IPC handler for setting grail items in the detection service.
   * @param _ - IPC event (unused)
   * @param items - Array of Holy Grail items to set for detection
   */
  ipcMain.handle('itemDetection:setGrailItems', async (_, items: Item[]) => {
    try {
      itemDetectionService.setGrailItems(items);
      return { success: true };
    } catch (error) {
      console.error('Failed to set grail items:', error);
      throw error;
    }
  });

  console.log('Save file IPC handlers initialized');
}

/**
 * Closes the save file monitor and stops monitoring.
 * Should be called when the application is shutting down to properly clean up resources.
 */
export function closeSaveFileMonitor(): void {
  if (saveFileMonitor) {
    saveFileMonitor.stopMonitoring();
  }
}
