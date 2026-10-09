import { ipcMain, webContents } from 'electron';
import { type GrailDatabase, grailDatabase } from '../database/database';
import type { Difficulty, GrailProgress, Settings } from '../types/grail';
import { RUN_TRACKER_SHORTCUT_ACTIONS } from '../utils/runTrackerShortcuts';

/**
 * Global database instance for grail operations.
 */
let grailDB: GrailDatabase;

/**
 * Main-process listeners notified after settings were persisted via IPC.
 */
const settingsUpdatedListeners = new Set<(settings: Partial<Settings>) => void>();

/**
 * Registers a main-process listener that is called after settings are updated from the renderer.
 * @param listener - Called with the partial settings that were saved
 * @returns Function that removes the listener
 */
export function addSettingsUpdatedListener(
  listener: (settings: Partial<Settings>) => void,
): () => void {
  settingsUpdatedListeners.add(listener);
  return () => {
    settingsUpdatedListeners.delete(listener);
  };
}

/**
 * Notifies main-process listeners about saved settings; a failing listener does not affect others.
 * @param settings - The partial settings that were saved
 */
function notifySettingsUpdatedListeners(settings: Partial<Settings>): void {
  for (const listener of settingsUpdatedListeners) {
    try {
      listener(settings);
    } catch (error) {
      console.error('Settings updated listener failed:', error);
    }
  }
}

/**
 * Validates renderer-provided settings whose type affects main-process behavior.
 * @param settings - The partial settings received over IPC
 * @throws Error if a validated setting has an invalid type
 */
function validateSettingsUpdate(settings: Partial<Settings>): void {
  if (
    settings.runTrackerGlobalHotkeys !== undefined &&
    typeof settings.runTrackerGlobalHotkeys !== 'boolean'
  ) {
    throw new Error('Invalid runTrackerGlobalHotkeys setting: expected a boolean');
  }

  if (
    settings.runTrackerShortcuts !== undefined &&
    !isValidRunTrackerShortcuts(settings.runTrackerShortcuts)
  ) {
    throw new Error(
      'Invalid runTrackerShortcuts setting: expected an object with a non-empty string for each shortcut action',
    );
  }
}

/**
 * Checks that a renderer-provided shortcut mapping has a non-empty string for every action.
 * @param value - The untrusted runTrackerShortcuts value received over IPC
 * @returns True if the value is a complete shortcut mapping
 */
function isValidRunTrackerShortcuts(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const shortcuts = value as Record<string, unknown>;
  return RUN_TRACKER_SHORTCUT_ACTIONS.every((action) => isNonEmptyString(shortcuts[action]));
}

/**
 * Converts a setting value to a string suitable for database storage.
 * Handles objects (JSON.stringify), undefined (skip), and primitives (String).
 * @param value - The setting value to convert
 * @returns String representation or null if value should be skipped
 */
function convertSettingValueToString(value: unknown): string | null {
  // Skip undefined values - don't save them
  if (value === undefined) {
    return null;
  }

  // Convert complex objects to JSON strings
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  // Convert primitives to strings
  return String(value);
}

const VALID_DIFFICULTIES: readonly Difficulty[] = ['normal', 'nightmare', 'hell'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

/**
 * Validates a renderer-provided grail progress payload before it is persisted.
 * @param value - The untrusted payload received over IPC
 * @returns True if the payload has the shape of a GrailProgress record
 */
export function isValidGrailProgress(value: unknown): value is GrailProgress {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const progress = value as Record<string, unknown>;
  const { foundDate, difficulty } = progress;

  return (
    isNonEmptyString(progress.id) &&
    isNonEmptyString(progress.characterId) &&
    isNonEmptyString(progress.itemId) &&
    typeof progress.isEthereal === 'boolean' &&
    typeof progress.manuallyAdded === 'boolean' &&
    isOptionalBoolean(progress.fromInitialScan) &&
    isOptionalString(progress.foundBy) &&
    isOptionalString(progress.notes) &&
    (foundDate === undefined ||
      (foundDate instanceof Date && !Number.isNaN(foundDate.getTime()))) &&
    (difficulty === undefined || VALID_DIFFICULTIES.includes(difficulty as Difficulty))
  );
}

/**
 * Enforces in the main process the rules the renderer applies when recording a find manually.
 * Auto-detected records are written by the main process itself, so this channel only accepts
 * manually added records. Re-saving an existing manual record (same ID) is allowed.
 * @param progress - The validated progress payload received over IPC
 * @throws If the record is not manual, references an unknown character, has a future found date,
 *   reuses the ID of an auto-detected record, or duplicates an existing record
 */
function assertManualProgressAllowed(progress: GrailProgress): void {
  if (!progress.manuallyAdded) {
    throw new Error('Only manually added progress can be saved');
  }

  if (!grailDB.getCharacterById(progress.characterId)) {
    throw new Error(`Unknown character: ${progress.characterId}`);
  }

  if (progress.foundDate && progress.foundDate.getTime() > Date.now()) {
    throw new Error('Found date cannot be in the future');
  }

  const existing = grailDB.getProgressById(progress.id);
  if (existing && !existing.manuallyAdded) {
    throw new Error(`Progress ID already in use: ${progress.id}`);
  }

  const alreadyRecorded = grailDB
    .getProgressByCharacter(progress.characterId)
    .some(
      (p) =>
        p.id !== progress.id &&
        p.itemId === progress.itemId &&
        p.isEthereal === progress.isEthereal &&
        p.foundDate !== undefined,
    );
  if (alreadyRecorded) {
    throw new Error(`Item already recorded for character: ${progress.characterId}`);
  }
}

/**
 * Notifies all renderer windows that grail progress changed so they can reload it.
 */
function notifyProgressUpdated(): void {
  const allWebContents = webContents.getAllWebContents();
  for (const wc of allWebContents) {
    if (!wc.isDestroyed() && wc.getType() === 'window') {
      wc.send('grail-progress-updated');
    }
  }
}

/**
 * Initializes IPC handlers for Holy Grail tracking operations.
 * Sets up handlers for characters, items, progress, settings, statistics, and backup operations.
 * Initializes the database connection and registers all IPC event handlers.
 */
export function initializeGrailHandlers(): void {
  // Initialize database using singleton
  try {
    // Import the singleton database instance
    grailDB = grailDatabase;
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
   * IPC handler for retrieving all runewords from the database.
   * Returns all runewords regardless of grailRunewords setting.
   * Used by the runeword calculator to work independently of tracking settings.
   */
  ipcMain.handle('grail:getAllRunewords', async () => {
    try {
      return grailDB.getAllRunewords();
    } catch (error) {
      console.error('Failed to get all runewords:', error);
      throw error;
    }
  });

  // Progress handlers
  /**
   * IPC handler for retrieving grail progress.
   * Returns all progress regardless of grail settings - filtering is done on the frontend.
   * This allows features like the runeword calculator to show collection counts even when
   * grailRunewords tracking is disabled.
   * @param _ - IPC event (unused)
   * @param characterId - Optional character ID to filter progress for specific character
   */
  ipcMain.handle('grail:getProgress', async (_, characterId?: string) => {
    try {
      const dbProgress = characterId
        ? grailDB.getProgressByCharacter(characterId)
        : grailDB.getAllProgress();

      // Use cached character map (invalidated by GrailDatabase on character mutations)
      const characterMap = grailDB.getCharacterMap();

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
   * Emits a grail-progress-updated event to all renderer windows after successful update.
   * @param _ - IPC event (unused)
   * @param progress - Grail progress data to update
   */
  ipcMain.handle('grail:updateProgress', async (_, progress: unknown) => {
    try {
      if (!isValidGrailProgress(progress)) {
        throw new Error('Invalid grail progress payload');
      }

      assertManualProgressAllowed(progress);

      grailDB.upsertProgress(progress);

      // Emit event to all renderer windows to refresh their progress data
      notifyProgressUpdated();

      return { success: true };
    } catch (error) {
      console.error('Failed to update progress:', error);
      throw error;
    }
  });

  /**
   * IPC handler for deleting a manually added grail progress record.
   * Auto-detected records are derived from save files and are not deletable.
   * Emits a grail-progress-updated event to all renderer windows after a successful delete.
   * @param _ - IPC event (unused)
   * @param progressId - ID of the progress record to delete
   */
  ipcMain.handle('grail:deleteProgress', async (_, progressId: unknown) => {
    try {
      if (!isNonEmptyString(progressId)) {
        throw new Error('Invalid progress ID');
      }

      const deleted = grailDB.deleteManualProgress(progressId);
      if (deleted) {
        notifyProgressUpdated();
      }

      return { success: deleted };
    } catch (error) {
      console.error('Failed to delete progress:', error);
      throw error;
    }
  });

  /**
   * IPC handler for retrieving grail progress for a specific item.
   * @param _ - IPC event (unused)
   * @param itemId - The item ID to get progress for
   */
  ipcMain.handle('grail:getProgressByItem', async (_, itemId: string) => {
    try {
      return grailDB.getProgressByItem(itemId);
    } catch (error) {
      console.error('Failed to get progress by item:', error);
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
   * Emits a settings-updated event to all renderer windows after successful update.
   * @param _ - IPC event (unused)
   * @param settings - Partial settings object to update
   */
  ipcMain.handle('grail:updateSettings', async (_, settings: Partial<Settings>) => {
    try {
      validateSettingsUpdate(settings);

      for (const key in settings) {
        const settingsKey = key as keyof Settings;
        const value = settings[settingsKey];
        const stringValue = convertSettingValueToString(value);

        // Skip if value should not be saved (undefined)
        if (stringValue !== null) {
          grailDB.setSetting(settingsKey, stringValue);
        }
      }

      // Emit event to all renderer windows to notify them of settings changes
      const allWebContents = webContents.getAllWebContents();
      for (const wc of allWebContents) {
        if (!wc.isDestroyed() && wc.getType() === 'window') {
          wc.send('settings-updated', settings);
        }
      }

      notifySettingsUpdatedListeners(settings);

      return { success: true };
    } catch (error) {
      console.error('Failed to update settings:', error);
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
      await grailDB.backup(backupPath);
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
