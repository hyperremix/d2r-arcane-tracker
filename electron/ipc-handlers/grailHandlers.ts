import { ipcMain } from 'electron';
import type { GrailDatabase } from '../database/database';
import type { BroadcastToRenderers } from '../ipc/broadcast';
import { createIpcMainRegistry } from '../ipc/handle';
import type { SettingsService } from '../services/settingsService';
import type { Difficulty, GrailProgress, Settings } from '../types/grail';
import { RUN_TRACKER_SHORTCUT_ACTIONS } from '../utils/runTrackerShortcuts';

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
function assertManualProgressAllowed(grailDB: GrailDatabase, progress: GrailProgress): void {
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

/** Dependencies of the grail IPC handlers. */
export interface GrailHandlerDependencies {
  database: GrailDatabase;
  settings: SettingsService;
  broadcastToRenderers: BroadcastToRenderers;
}

/**
 * Initializes IPC handlers for Holy Grail tracking operations.
 * Sets up handlers for characters, items, progress, settings, statistics, and backup operations.
 * @param deps - The grail database, the settings service and the renderer broadcast
 */
export function initializeGrailHandlers({
  database: grailDB,
  settings: settingsService,
  broadcastToRenderers,
}: GrailHandlerDependencies): void {
  const { handle } = createIpcMainRegistry(ipcMain);

  /** Notifies all renderer windows that grail progress changed so they can reload it. */
  const notifyProgressUpdated = () => broadcastToRenderers('grail-progress-updated');

  // Character handlers
  /**
   * IPC handler for retrieving all characters.
   * Maps database character format to renderer format with proper date conversion.
   */
  handle('grail:getCharacters', async () => {
    return grailDB.getAllCharacters();
  });

  // Items handlers
  /**
   * IPC handler for retrieving all grail items.
   * Returns items filtered by current settings and maps database format to renderer format.
   */
  handle('grail:getItems', async () => {
    const settings = settingsService.getAll();
    return grailDB.getFilteredItems(settings);
  });

  /**
   * IPC handler for retrieving all runewords from the database.
   * Returns all runewords regardless of grailRunewords setting.
   * Used by the runeword calculator to work independently of tracking settings.
   */
  handle('grail:getAllRunewords', async () => {
    return grailDB.getAllRunewords();
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
  handle('grail:getProgress', async (_, characterId) => {
    const dbProgress = characterId
      ? grailDB.getProgressByCharacter(characterId)
      : grailDB.getAllProgress();

    // Use cached character map (invalidated by GrailDatabase on character mutations)
    const characterMap = grailDB.getCharacterMap();

    return dbProgress.map((prog) => ({
      ...prog,
      foundBy: characterMap.get(prog.characterId),
    }));
  });

  /**
   * IPC handler for updating grail progress.
   * Emits a grail-progress-updated event to all renderer windows after successful update.
   * @param _ - IPC event (unused)
   * @param progress - Grail progress data to update
   */
  handle('grail:updateProgress', async (_, progress: unknown) => {
    if (!isValidGrailProgress(progress)) {
      throw new Error('Invalid grail progress payload');
    }

    assertManualProgressAllowed(grailDB, progress);

    grailDB.upsertProgress(progress);

    // Emit event to all renderer windows to refresh their progress data
    notifyProgressUpdated();

    return { success: true };
  });

  /**
   * IPC handler for deleting a manually added grail progress record.
   * Auto-detected records are derived from save files and are not deletable.
   * Emits a grail-progress-updated event to all renderer windows after a successful delete.
   * @param _ - IPC event (unused)
   * @param progressId - ID of the progress record to delete
   */
  handle('grail:deleteProgress', async (_, progressId) => {
    const deleted = grailDB.deleteManualProgress(progressId);
    if (deleted) {
      notifyProgressUpdated();
    }

    return { success: deleted };
  });

  /**
   * IPC handler for retrieving grail progress for a specific item.
   * @param _ - IPC event (unused)
   * @param itemId - The item ID to get progress for
   */
  handle('grail:getProgressByItem', async (_, itemId) => {
    return grailDB.getProgressByItem(itemId);
  });

  // Settings handlers
  /**
   * IPC handler for retrieving all user settings.
   */
  handle('grail:getSettings', async () => {
    return settingsService.getAll();
  });

  /**
   * IPC handler for updating user settings.
   * Emits a settings-updated event to all renderer windows after successful update.
   * @param _ - IPC event (unused)
   * @param settings - Partial settings object to update
   */
  handle('grail:updateSettings', async (_, settings) => {
    validateSettingsUpdate(settings);

    // Stores the values and notifies main-process listeners (run tracker, global hotkeys)
    settingsService.update(settings);

    // Emit event to all renderer windows to notify them of settings changes
    broadcastToRenderers('settings-updated', settings);

    return { success: true };
  });

  // Backup handlers
  /**
   * IPC handler for creating a database backup.
   * @param _ - IPC event (unused)
   * @param backupPath - File path where the backup should be saved
   */
  handle('grail:backup', async (_, backupPath) => {
    await grailDB.backup(backupPath);
    return { success: true };
  });

  /**
   * IPC handler for restoring database from backup file.
   * @param _ - IPC event (unused)
   * @param backupPath - File path of the backup to restore from
   */
  handle('grail:restore', async (_, backupPath) => {
    grailDB.restore(backupPath);
    settingsService.notifyRestored();
    return { success: true };
  });

  /**
   * IPC handler for restoring database from backup buffer.
   * @param _ - IPC event (unused)
   * @param backupBuffer - Buffer containing the backup data
   */
  handle('grail:restoreFromBuffer', async (_, backupBuffer) => {
    grailDB.restoreFromBuffer(Buffer.from(backupBuffer));
    settingsService.notifyRestored();
    return { success: true };
  });

  console.log('Grail IPC handlers initialized');
}
