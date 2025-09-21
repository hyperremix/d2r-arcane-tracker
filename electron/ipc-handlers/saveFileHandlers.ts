import { ipcMain, webContents } from 'electron';
import { grailDatabase } from '../database/database';
import type { ItemDetectionEvent } from '../services/itemDetection';
import { ItemDetectionService } from '../services/itemDetection';
import type { D2SaveFile, SaveFileEvent } from '../services/saveFileMonitor';
import { SaveFileMonitor } from '../services/saveFileMonitor';
import type {
  ArmorSubCategory,
  CharmSubCategory,
  HolyGrailItem,
  ItemCategory,
  JewelrySubCategory,
  RuneSubCategory,
  RunewordSubCategory,
  WeaponSubCategory,
} from '../types/grail';

let saveFileMonitor: SaveFileMonitor;
let itemDetectionService: ItemDetectionService;

// Helper function to handle automatic grail progress updates
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
        character_class: 'unknown', // We'll update this from save file data
        level: event.item.level || 1,
        difficulty: 'normal' as const,
        hardcore: false,
        expansion: true,
        save_file_path: undefined,
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
      .getProgressByItem(event.item.id)
      .find((p) => p.found);

    const isFirstTimeDiscovery = !existingGlobalProgress;

    // Create grail progress entry for this character
    const progressId = `progress_${character.id}_${event.item.id}_${Date.now()}`;
    const grailProgress = {
      id: progressId,
      character_id: character.id,
      item_id: event.item.id,
      found: true,
      found_date: new Date().toISOString(),
      manually_added: false,
      auto_detected: true,
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

// Helper function to update character from save file data
function updateCharacterFromSaveFile(saveFile: D2SaveFile): void {
  try {
    const character =
      grailDatabase.getCharacterBySaveFilePath(saveFile.path) ||
      grailDatabase.getCharacterByName(saveFile.name);

    if (character) {
      // Update existing character
      grailDatabase.updateCharacter(character.id, {
        character_class: saveFile.characterClass,
        level: saveFile.level,
        difficulty: saveFile.difficulty,
        hardcore: saveFile.hardcore,
        expansion: saveFile.expansion,
        save_file_path: saveFile.path,
      });
    } else {
      // Create new character
      const characterId = `char_${saveFile.name}_${Date.now()}`;

      grailDatabase.upsertCharacter({
        id: characterId,
        name: saveFile.name,
        character_class: saveFile.characterClass,
        level: saveFile.level,
        difficulty: saveFile.difficulty,
        hardcore: saveFile.hardcore,
        expansion: saveFile.expansion,
        save_file_path: saveFile.path,
      });
      console.log(
        `Created character from save file: ${saveFile.name} (${saveFile.characterClass})`,
      );
    }
  } catch (error) {
    console.error('Error updating character from save file:', error);
  }
}

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
    const grailItems: HolyGrailItem[] = grailDatabase.getAllItems().map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type as 'unique' | 'set' | 'rune' | 'runeword',
      category: item.category as ItemCategory,
      subCategory: item.sub_category as
        | WeaponSubCategory
        | ArmorSubCategory
        | JewelrySubCategory
        | CharmSubCategory
        | RuneSubCategory
        | RunewordSubCategory,
      level: 1,
      requiredLevel: 1,
      rarity: 'common' as const,
      difficulty: ['normal'] as const,
      setName: item.set_name,
      etherealType: item.ethereal_type,
    }));
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

  ipcMain.handle('saveFile:getSaveFiles', async (): Promise<D2SaveFile[]> => {
    try {
      return await saveFileMonitor.getSaveFiles();
    } catch (error) {
      console.error('Failed to get save files:', error);
      throw error;
    }
  });

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
  ipcMain.handle('itemDetection:enable', async () => {
    try {
      itemDetectionService.enable();
      return { success: true };
    } catch (error) {
      console.error('Failed to enable item detection:', error);
      throw error;
    }
  });

  ipcMain.handle('itemDetection:disable', async () => {
    try {
      itemDetectionService.disable();
      return { success: true };
    } catch (error) {
      console.error('Failed to disable item detection:', error);
      throw error;
    }
  });

  ipcMain.handle('itemDetection:setGrailItems', async (_, items: HolyGrailItem[]) => {
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

export function closeSaveFileMonitor(): void {
  if (saveFileMonitor) {
    saveFileMonitor.stopMonitoring();
  }
}
