import type {
  Character,
  DatabaseCharacter,
  DatabaseGrailProgress,
  DatabaseItem,
  DatabaseRun,
  DatabaseRunItem,
  DatabaseSaveFileState,
  DatabaseSession,
  GrailProgress,
  Item,
  Run,
  RunItem,
  SaveFileState,
  Session,
} from '../types/grail';

/**
 * Converts a boolean value to SQLite-compatible integer (0 or 1).
 * @param value - The boolean value to convert
 * @returns 1 for true, 0 for false
 */
export function toSqliteBoolean(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

/**
 * Converts undefined to null for SQLite compatibility.
 * @param value - The value that might be undefined
 * @returns The original value or null if undefined
 */
export function toSqliteNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

/**
 * Converts a Date object or string to ISO string format for SQLite storage.
 * @param value - The date value to convert
 * @returns ISO string or null if undefined/null
 */
export function toSqliteDate(value: Date | string | undefined | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

/**
 * Maps a Character object to DatabaseCharacter format with SQLite-compatible types.
 * @param character - The character object to map (with booleans and optional fields)
 * @returns Database character object with converted types
 */
export function mapCharacterToDatabase(character: {
  id: string;
  name: string;
  character_class: DatabaseCharacter['character_class'];
  level: number;
  hardcore: boolean;
  expansion: boolean;
  save_file_path?: string;
}): Omit<DatabaseCharacter, 'created_at' | 'updated_at' | 'deleted_at'> {
  return {
    id: character.id,
    name: character.name,
    character_class: character.character_class,
    level: character.level,
    hardcore: toSqliteBoolean(character.hardcore),
    expansion: toSqliteBoolean(character.expansion),
    save_file_path: toSqliteNull(character.save_file_path),
  };
}

/**
 * Maps a GrailProgress object to DatabaseGrailProgress format with SQLite-compatible types.
 * @param progress - The progress object to map (with booleans and optional fields)
 * @returns Database progress object with converted types
 */
export function mapProgressToDatabase(
  progress: GrailProgress,
): Omit<DatabaseGrailProgress, 'created_at' | 'updated_at'> {
  return {
    id: progress.id,
    character_id: progress.characterId,
    item_id: progress.itemId,
    found_date: toSqliteDate(progress.foundDate),
    manually_added: toSqliteBoolean(progress.manuallyAdded),
    auto_detected: toSqliteBoolean(true),
    difficulty: toSqliteNull(progress.difficulty),
    notes: toSqliteNull(progress.notes),
    is_ethereal: toSqliteBoolean(progress.isEthereal),
    from_initial_scan: toSqliteBoolean(progress.fromInitialScan ?? false),
  };
}

/**
 * Maps an Item object to DatabaseItem format with SQLite-compatible types.
 * @param item - The item object to map
 * @returns Database item object with converted types
 */
export function mapItemToDatabase(item: Item): Omit<DatabaseItem, 'created_at' | 'updated_at'> {
  return {
    id: item.id,
    name: item.name,
    link: item.link,
    code: toSqliteNull(item.code),
    item_base: toSqliteNull(item.itemBase),
    image_filename: toSqliteNull(item.imageFilename),
    type: item.type,
    category: item.category,
    sub_category: item.subCategory,
    treasure_class: item.treasureClass,
    set_name: toSqliteNull(item.setName),
    runes: item.runes ? JSON.stringify(item.runes) : null,
    ethereal_type: item.etherealType,
  };
}

/**
 * Maps any object values to SQLite-compatible types.
 * This is used for dynamic updates where we don't know the exact structure.
 * @param values - Array of values that might need conversion
 * @returns Array of SQLite-compatible values
 */
export function mapValuesToSqlite(values: unknown[]): (string | number | null)[] {
  return values.map((value) => {
    if (value === undefined) {
      return null;
    }

    if (value === null) {
      return null;
    }

    if (typeof value === 'boolean') {
      return toSqliteBoolean(value);
    }

    if (value instanceof Date) {
      return toSqliteDate(value);
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }

    // For other types, convert to string
    return String(value);
  });
}

/**
 * Converts a SQLite integer (0 or 1) back to a boolean.
 * @param value - The SQLite integer value to convert
 * @returns true for 1, false for 0
 */
export function fromSqliteBoolean(value: 0 | 1): boolean {
  return value === 1;
}

/**
 * Converts a SQLite date string back to a Date object.
 * @param value - The SQLite date string to convert
 * @returns Date object or undefined if value is null
 */
export function fromSqliteDate(value: string | null): Date | undefined {
  if (value === null) {
    return undefined;
  }
  return new Date(value);
}

/**
 * Maps a DatabaseCharacter back to Character format.
 * @param dbCharacter - The database character object to convert
 * @returns Character object with original types
 */
export function mapDatabaseCharacterToCharacter(dbCharacter: DatabaseCharacter): Character {
  return {
    id: dbCharacter.id,
    name: dbCharacter.name,
    characterClass: dbCharacter.character_class,
    level: dbCharacter.level,
    hardcore: fromSqliteBoolean(dbCharacter.hardcore),
    expansion: fromSqliteBoolean(dbCharacter.expansion),
    saveFilePath: dbCharacter.save_file_path || undefined,
    lastUpdated: new Date(dbCharacter.updated_at),
    created: new Date(dbCharacter.created_at),
    deleted: dbCharacter.deleted_at ? new Date(dbCharacter.deleted_at) : undefined,
  };
}

/**
 * Maps a DatabaseGrailProgress back to GrailProgress format.
 * @param dbProgress - The database progress object to convert
 * @returns GrailProgress object with original types
 */
export function mapDatabaseProgressToProgress(dbProgress: DatabaseGrailProgress): GrailProgress {
  return {
    id: dbProgress.id,
    characterId: dbProgress.character_id,
    itemId: dbProgress.item_id,
    foundDate: fromSqliteDate(dbProgress.found_date),
    foundBy: undefined, // This field is not stored in the database
    manuallyAdded: fromSqliteBoolean(dbProgress.manually_added),
    difficulty: dbProgress.difficulty || undefined,
    notes: dbProgress.notes || undefined,
    isEthereal: fromSqliteBoolean(dbProgress.is_ethereal),
    fromInitialScan: fromSqliteBoolean(dbProgress.from_initial_scan),
  };
}

/**
 * Maps a DatabaseItem back to Item format.
 * @param dbItem - The database item object to convert
 * @returns Item object with original types
 */
export function mapDatabaseItemToItem(dbItem: DatabaseItem): Item {
  let runes: string[] | undefined;
  if (dbItem.runes) {
    try {
      runes = JSON.parse(dbItem.runes) as string[];
    } catch (error) {
      console.error('Failed to parse runes JSON:', error);
      runes = undefined;
    }
  }

  return {
    id: dbItem.id,
    name: dbItem.name,
    link: dbItem.link,
    code: dbItem.code || undefined,
    itemBase: dbItem.item_base || undefined,
    imageFilename: dbItem.image_filename || undefined,
    etherealType: dbItem.ethereal_type,
    type: dbItem.type,
    category: dbItem.category,
    subCategory: dbItem.sub_category,
    treasureClass: dbItem.treasure_class,
    setName: dbItem.set_name || undefined,
    runes,
  };
}

/**
 * Maps a SaveFileState object to DatabaseSaveFileState format with SQLite-compatible types.
 * @param saveFileState - The save file state object to map (with Date objects)
 * @returns Database save file state object with converted types
 */
export function mapSaveFileStateToDatabase(
  saveFileState: SaveFileState,
): Omit<DatabaseSaveFileState, 'created_at' | 'updated_at'> {
  return {
    id: saveFileState.id,
    file_path: saveFileState.filePath,
    last_modified: saveFileState.lastModified.toISOString(),
    last_parsed: saveFileState.lastParsed.toISOString(),
  };
}

/**
 * Maps a DatabaseSaveFileState back to SaveFileState format.
 * @param dbSaveFileState - The database save file state object to convert
 * @returns SaveFileState object with original types
 */
export function mapDatabaseSaveFileStateToSaveFileState(
  dbSaveFileState: DatabaseSaveFileState,
): SaveFileState {
  return {
    id: dbSaveFileState.id,
    filePath: dbSaveFileState.file_path,
    lastModified: new Date(dbSaveFileState.last_modified),
    lastParsed: new Date(dbSaveFileState.last_parsed),
    created: new Date(dbSaveFileState.created_at),
    updated: new Date(dbSaveFileState.updated_at),
  };
}

/**
 * Maps a Session object to DatabaseSession format with SQLite-compatible types.
 * @param session - The session object to map (with Date objects and optional fields)
 * @returns Database session object with converted types
 */
export function mapSessionToDatabase(
  session: Session,
): Omit<DatabaseSession, 'created_at' | 'updated_at'> {
  return {
    id: session.id,
    character_id: toSqliteNull(session.characterId),
    start_time: session.startTime.toISOString(),
    end_time: toSqliteDate(session.endTime),
    total_run_time: session.totalRunTime,
    total_session_time: session.totalSessionTime,
    run_count: session.runCount,
    archived: toSqliteBoolean(session.archived),
    notes: toSqliteNull(session.notes),
  };
}

/**
 * Maps a DatabaseSession back to Session format.
 * @param dbSession - The database session object to convert
 * @returns Session object with original types
 */
export function mapDatabaseSessionToSession(dbSession: DatabaseSession): Session {
  return {
    id: dbSession.id,
    characterId: dbSession.character_id || undefined,
    startTime: new Date(dbSession.start_time),
    endTime: fromSqliteDate(dbSession.end_time),
    totalRunTime: dbSession.total_run_time,
    totalSessionTime: dbSession.total_session_time,
    runCount: dbSession.run_count,
    archived: fromSqliteBoolean(dbSession.archived),
    notes: dbSession.notes || undefined,
    created: new Date(dbSession.created_at),
    lastUpdated: new Date(dbSession.updated_at),
  };
}

/**
 * Maps a Run object to DatabaseRun format with SQLite-compatible types.
 * @param run - The run object to map (with Date objects and optional fields)
 * @returns Database run object with converted types
 */
export function mapRunToDatabase(run: Run): Omit<DatabaseRun, 'created_at' | 'updated_at'> {
  return {
    id: run.id,
    session_id: run.sessionId,
    character_id: run.characterId,
    run_number: run.runNumber,
    run_type: toSqliteNull(run.runType),
    start_time: run.startTime.toISOString(),
    end_time: toSqliteDate(run.endTime),
    duration: toSqliteNull(run.duration),
    area: toSqliteNull(run.area),
  };
}

/**
 * Maps a DatabaseRun back to Run format.
 * @param dbRun - The database run object to convert
 * @returns Run object with original types
 */
export function mapDatabaseRunToRun(dbRun: DatabaseRun): Run {
  return {
    id: dbRun.id,
    sessionId: dbRun.session_id,
    characterId: dbRun.character_id,
    runNumber: dbRun.run_number,
    runType: dbRun.run_type || undefined,
    startTime: new Date(dbRun.start_time),
    endTime: fromSqliteDate(dbRun.end_time),
    duration: dbRun.duration || undefined,
    area: dbRun.area || undefined,
    created: new Date(dbRun.created_at),
    lastUpdated: new Date(dbRun.updated_at),
  };
}

/**
 * Maps a RunItem object to DatabaseRunItem format with SQLite-compatible types.
 * @param runItem - The run item object to map (with Date objects)
 * @returns Database run item object with converted types
 */
export function mapRunItemToDatabase(runItem: RunItem): Omit<DatabaseRunItem, 'created_at'> {
  return {
    id: runItem.id,
    run_id: runItem.runId,
    grail_progress_id: runItem.grailProgressId,
    found_time: runItem.foundTime.toISOString(),
  };
}

/**
 * Maps a DatabaseRunItem back to RunItem format.
 * @param dbRunItem - The database run item object to convert
 * @returns RunItem object with original types
 */
export function mapDatabaseRunItemToRunItem(dbRunItem: DatabaseRunItem): RunItem {
  return {
    id: dbRunItem.id,
    runId: dbRunItem.run_id,
    grailProgressId: dbRunItem.grail_progress_id,
    foundTime: new Date(dbRunItem.found_time),
    created: new Date(dbRunItem.created_at),
  };
}
