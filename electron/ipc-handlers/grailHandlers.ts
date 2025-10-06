import { ipcMain } from 'electron';
import { GrailDatabase } from '../database/database';
import type { GrailProgress, Item, Settings } from '../types/grail';

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
      return grailDB.getAllCharacters();
    } catch (error) {
      console.error('Failed to get characters:', error);
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
      return grailDB.getFilteredItems(settings);
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
  ipcMain.handle('grail:seedItems', async (_, items: Item[]) => {
    try {
      grailDB.insertItems(items);
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

      return dbProgress.map((prog) => ({
        ...prog,
        foundBy: characterMap.get(prog.characterId),
      }));
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
      grailDB.upsertProgress(progress);
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
 * Closes the grail database connection.
 * Should be called when the application is shutting down to properly clean up resources.
 */
export function closeGrailDatabase(): void {
  if (grailDB) {
    grailDB.close();
  }
}
