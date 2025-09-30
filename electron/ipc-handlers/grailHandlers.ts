import { ipcMain } from 'electron';
import { GrailDatabase } from '../database/database';
import type { Character, GrailProgress, HolyGrailItem, Settings } from '../types/grail';

/**
 * Global database instance for grail operations.
 */
let grailDB: GrailDatabase;

/**
 * Initializes IPC handlers for Holy Grail tracking operations.
 * Sets up handlers for characters, items, progress, settings, statistics, and backup operations.
 * Initializes the database connection and registers all IPC event handlers.
 */
export function initializeGrailHandlers(): void {
  // Initialize database
  try {
    grailDB = new GrailDatabase();
  } catch (error) {
    console.error('Failed to initialize grail database:', error);
    return;
  }

  // Character handlers
  /**
   * IPC handler for retrieving all characters.
   * Maps database character format to renderer format with proper date conversion.
   */
  ipcMain.handle('grail:getCharacters', async () => {
    try {
      const dbCharacters = grailDB.getAllCharacters();
      return dbCharacters.map(
        (dbChar) =>
          ({
            id: dbChar.id,
            name: dbChar.name,
            characterClass: dbChar.character_class,
            level: dbChar.level,
            difficulty: dbChar.difficulty,
            hardcore: dbChar.hardcore,
            expansion: dbChar.expansion,
            saveFilePath: dbChar.save_file_path,
            created: new Date(dbChar.created_at),
            lastUpdated: new Date(dbChar.updated_at),
            deleted: dbChar.deleted_at ? new Date(dbChar.deleted_at) : undefined,
          }) as Character,
      );
    } catch (error) {
      console.error('Failed to get characters:', error);
      throw error;
    }
  });

  /**
   * IPC handler for creating a new character.
   * @param _ - IPC event (unused)
   * @param character - Character data to create
   */
  ipcMain.handle('grail:createCharacter', async (_, character: Character) => {
    try {
      grailDB.insertCharacter({
        id: character.id,
        name: character.name,
        character_class: character.characterClass,
        level: character.level,
        difficulty: character.difficulty,
        hardcore: character.hardcore,
        expansion: character.expansion,
        save_file_path: character.saveFilePath,
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to create character:', error);
      throw error;
    }
  });

  /**
   * IPC handler for updating an existing character.
   * @param _ - IPC event (unused)
   * @param characterId - ID of the character to update
   * @param updates - Partial character data to update
   */
  ipcMain.handle(
    'grail:updateCharacter',
    async (_, characterId: string, updates: Partial<Character>) => {
      try {
        const dbUpdates = mapCharacterUpdates(updates);
        grailDB.updateCharacter(characterId, dbUpdates);
        return { success: true };
      } catch (error) {
        console.error('Failed to update character:', error);
        throw error;
      }
    },
  );

  /**
   * IPC handler for deleting a character (soft delete).
   * @param _ - IPC event (unused)
   * @param characterId - ID of the character to delete
   */
  ipcMain.handle('grail:deleteCharacter', async (_, characterId: string) => {
    try {
      grailDB.deleteCharacter(characterId);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete character:', error);
      throw error;
    }
  });

  // Items handlers
  /**
   * IPC handler for retrieving all grail items.
   * Returns items filtered by current settings and maps database format to renderer format.
   */
  ipcMain.handle('grail:getItems', async () => {
    try {
      const settings = grailDB.getAllSettings();
      const dbItems = grailDB.getFilteredItems(settings);
      return dbItems.map(
        (dbItem) =>
          ({
            id: dbItem.id,
            name: dbItem.name,
            type: dbItem.type,
            category: dbItem.category,
            subCategory: dbItem.sub_category,
            level: 0, // Default values for missing fields
            requiredLevel: 0,
            rarity: 'common',
            difficulty: ['normal', 'nightmare', 'hell'],
            setName: dbItem.set_name,
            etherealType: dbItem.ethereal_type,
          }) as HolyGrailItem,
      );
    } catch (error) {
      console.error('Failed to get items:', error);
      throw error;
    }
  });

  /**
   * IPC handler for seeding items into the database.
   * @param _ - IPC event (unused)
   * @param items - Array of Holy Grail items to seed
   */
  ipcMain.handle('grail:seedItems', async (_, items: HolyGrailItem[]) => {
    try {
      const dbItems = items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        category: item.category,
        sub_category: item.subCategory,
        set_name: item.setName,
        ethereal_type: item.etherealType,
      }));

      grailDB.insertItems(dbItems);
      return { success: true };
    } catch (error) {
      console.error('Failed to seed items:', error);
      throw error;
    }
  });

  // Progress handlers
  /**
   * IPC handler for retrieving grail progress.
   * @param _ - IPC event (unused)
   * @param characterId - Optional character ID to filter progress for specific character
   */
  ipcMain.handle('grail:getProgress', async (_, characterId?: string) => {
    try {
      const settings = grailDB.getAllSettings();
      const dbProgress = characterId
        ? grailDB.getProgressByCharacter(characterId)
        : grailDB.getFilteredProgress(settings);

      // Get all characters to map character IDs to names
      const characters = grailDB.getAllCharacters();
      const characterMap = new Map(characters.map((c) => [c.id, c.name]));

      return dbProgress.map(
        (dbProg) =>
          ({
            id: dbProg.id,
            characterId: dbProg.character_id,
            itemId: dbProg.item_id,
            found: dbProg.found,
            foundDate: dbProg.found_date ? new Date(dbProg.found_date) : undefined,
            foundBy: characterMap.get(dbProg.character_id),
            manuallyAdded: dbProg.manually_added,
            difficulty: dbProg.difficulty,
            notes: dbProg.notes,
          }) as GrailProgress,
      );
    } catch (error) {
      console.error('Failed to get progress:', error);
      throw error;
    }
  });

  /**
   * IPC handler for updating grail progress.
   * @param _ - IPC event (unused)
   * @param progress - Grail progress data to update
   */
  ipcMain.handle('grail:updateProgress', async (_, progress: GrailProgress) => {
    try {
      grailDB.upsertProgress({
        id: progress.id,
        character_id: progress.characterId,
        item_id: progress.itemId,
        found: progress.found,
        found_date: progress.foundDate?.toISOString(),
        manually_added: progress.manuallyAdded,
        auto_detected: false, // Manual updates are not auto-detected
        difficulty: progress.difficulty,
        notes: progress.notes,
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to update progress:', error);
      throw error;
    }
  });

  // Settings handlers
  /**
   * IPC handler for retrieving all user settings.
   */
  ipcMain.handle('grail:getSettings', async () => {
    try {
      return grailDB.getAllSettings();
    } catch (error) {
      console.error('Failed to get settings:', error);
      throw error;
    }
  });

  /**
   * IPC handler for updating user settings.
   * @param _ - IPC event (unused)
   * @param settings - Partial settings object to update
   */
  ipcMain.handle('grail:updateSettings', async (_, settings: Partial<Settings>) => {
    try {
      for (const key in settings) {
        const settingsKey = key as keyof Settings;
        grailDB.setSetting(settingsKey, String(settings[settingsKey]));
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  });

  // Statistics handlers
  /**
   * IPC handler for retrieving grail statistics.
   * @param _ - IPC event (unused)
   * @param characterId - Optional character ID to get statistics for specific character
   */
  ipcMain.handle('grail:getStatistics', async (_, characterId?: string) => {
    try {
      const settings = grailDB.getAllSettings();
      const stats = grailDB.getFilteredGrailStatistics(settings, characterId);
      return stats;
    } catch (error) {
      console.error('Failed to get statistics:', error);
      throw error;
    }
  });

  // Backup handlers
  /**
   * IPC handler for creating a database backup.
   * @param _ - IPC event (unused)
   * @param backupPath - File path where the backup should be saved
   */
  ipcMain.handle('grail:backup', async (_, backupPath: string) => {
    try {
      grailDB.backup(backupPath);
      return { success: true };
    } catch (error) {
      console.error('Failed to backup database:', error);
      throw error;
    }
  });

  /**
   * IPC handler for restoring database from backup file.
   * @param _ - IPC event (unused)
   * @param backupPath - File path of the backup to restore from
   */
  ipcMain.handle('grail:restore', async (_, backupPath: string) => {
    try {
      grailDB.restore(backupPath);
      return { success: true };
    } catch (error) {
      console.error('Failed to restore database:', error);
      throw error;
    }
  });

  /**
   * IPC handler for restoring database from backup buffer.
   * @param _ - IPC event (unused)
   * @param backupBuffer - Buffer containing the backup data
   */
  ipcMain.handle('grail:restoreFromBuffer', async (_, backupBuffer: Uint8Array) => {
    try {
      grailDB.restoreFromBuffer(Buffer.from(backupBuffer));
      return { success: true };
    } catch (error) {
      console.error('Failed to restore database from buffer:', error);
      throw error;
    }
  });

  /**
   * IPC handler for truncating all user data (characters and progress).
   * This removes all characters and their associated progress while keeping items and settings.
   */
  ipcMain.handle('grail:truncateUserData', async () => {
    try {
      grailDB.truncateUserData();
      return { success: true };
    } catch (error) {
      console.error('Failed to truncate user data:', error);
      throw error;
    }
  });

  console.log('Grail IPC handlers initialized');
}

/**
 * Maps character update fields from the renderer format to database format.
 * Converts camelCase field names to snake_case for database compatibility.
 * @param updates - Partial character data to map
 * @returns Mapped character data in database format
 */
function mapCharacterUpdates(updates: Partial<Character>): Record<string, unknown> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.characterClass !== undefined) dbUpdates.character_class = updates.characterClass;
  if (updates.level !== undefined) dbUpdates.level = updates.level;
  if (updates.difficulty !== undefined) dbUpdates.difficulty = updates.difficulty;
  if (updates.hardcore !== undefined) dbUpdates.hardcore = updates.hardcore;
  if (updates.expansion !== undefined) dbUpdates.expansion = updates.expansion;
  if (updates.saveFilePath !== undefined) dbUpdates.save_file_path = updates.saveFilePath;
  if (updates.deleted !== undefined) dbUpdates.deleted = updates.deleted;
  return dbUpdates;
}

/**
 * Closes the grail database connection.
 * Should be called when the application is shutting down to properly clean up resources.
 */
export function closeGrailDatabase(): void {
  if (grailDB) {
    grailDB.close();
  }
}
