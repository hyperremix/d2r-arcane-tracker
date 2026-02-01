import { copyFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { app } from 'electron';
import { items as grailItemsData } from '../items';
import type {
  Character,
  GrailProgress,
  Item,
  Run,
  RunItem,
  RunStatistics,
  SaveFileState,
  Session,
  SessionStats,
  Settings,
} from '../types/grail';
import { GameMode, GameVersion } from '../types/grail';
import {
  createDrizzleDb,
  type DbCharacter,
  type DbGrailProgress,
  type DbItem,
  type DbRun,
  type DbRunItem,
  type DbSaveFileState,
  type DbSession,
  type DrizzleDb,
  schema,
} from './drizzle';

const { items, characters, grailProgress, settings, saveFileStates, sessions, runs, runItems } =
  schema;

// ============================================================================
// Type Conversion Helpers
// ============================================================================

function toISOString(date: Date | undefined | null): string | null {
  if (!date) return null;
  return date.toISOString();
}

function fromISOString(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr) return undefined;
  return new Date(dateStr);
}

// App to Database type mappers
function itemToDbValues(item: Item) {
  return {
    id: item.id,
    name: item.name,
    link: item.link,
    code: item.code ?? null,
    itemBase: item.itemBase ?? null,
    imageFilename: item.imageFilename ?? null,
    type: item.type,
    category: item.category,
    subCategory: item.subCategory,
    treasureClass: item.treasureClass,
    setName: item.setName ?? null,
    runes: item.runes ? JSON.stringify(item.runes) : null,
    etherealType: item.etherealType,
  };
}

// Database to App type mappers
function dbItemToItem(dbItem: DbItem): Item {
  let runesArray: string[] | undefined;
  if (dbItem.runes) {
    try {
      runesArray = JSON.parse(dbItem.runes) as string[];
    } catch {
      runesArray = undefined;
    }
  }

  return {
    id: dbItem.id,
    name: dbItem.name,
    link: dbItem.link ?? '',
    code: dbItem.code ?? undefined,
    itemBase: dbItem.itemBase ?? undefined,
    imageFilename: dbItem.imageFilename ?? undefined,
    etherealType: dbItem.etherealType,
    type: dbItem.type,
    category: dbItem.category,
    subCategory: dbItem.subCategory,
    treasureClass: dbItem.treasureClass,
    setName: dbItem.setName ?? undefined,
    runes: runesArray,
  };
}

function dbCharacterToCharacter(dbChar: DbCharacter): Character {
  return {
    id: dbChar.id,
    name: dbChar.name,
    characterClass: dbChar.characterClass,
    level: dbChar.level,
    hardcore: dbChar.hardcore,
    expansion: dbChar.expansion,
    saveFilePath: dbChar.saveFilePath ?? undefined,
    lastUpdated: new Date(dbChar.updatedAt ?? new Date().toISOString()),
    created: new Date(dbChar.createdAt ?? new Date().toISOString()),
    deleted: dbChar.deletedAt ? new Date(dbChar.deletedAt) : undefined,
  };
}

function dbProgressToProgress(dbProg: DbGrailProgress): GrailProgress {
  return {
    id: dbProg.id,
    characterId: dbProg.characterId,
    itemId: dbProg.itemId,
    foundDate: fromISOString(dbProg.foundDate),
    foundBy: undefined, // This field is not stored in database
    manuallyAdded: dbProg.manuallyAdded,
    difficulty: dbProg.difficulty ?? undefined,
    notes: dbProg.notes ?? undefined,
    isEthereal: dbProg.isEthereal,
    fromInitialScan: dbProg.fromInitialScan,
  };
}

function dbSaveFileStateToSaveFileState(dbState: DbSaveFileState): SaveFileState {
  return {
    id: dbState.id,
    filePath: dbState.filePath,
    lastModified: new Date(dbState.lastModified),
    lastParsed: new Date(dbState.lastParsed),
    created: new Date(dbState.createdAt ?? new Date().toISOString()),
    updated: new Date(dbState.updatedAt ?? new Date().toISOString()),
  };
}

function dbSessionToSession(dbSession: DbSession): Session {
  return {
    id: dbSession.id,
    startTime: new Date(dbSession.startTime),
    endTime: fromISOString(dbSession.endTime),
    totalRunTime: dbSession.totalRunTime ?? 0,
    totalSessionTime: dbSession.totalSessionTime ?? 0,
    runCount: dbSession.runCount ?? 0,
    archived: dbSession.archived ?? false,
    notes: dbSession.notes ?? undefined,
    created: new Date(dbSession.createdAt ?? new Date().toISOString()),
    lastUpdated: new Date(dbSession.updatedAt ?? new Date().toISOString()),
  };
}

function dbRunToRun(dbRun: DbRun): Run {
  return {
    id: dbRun.id,
    sessionId: dbRun.sessionId,
    characterId: dbRun.characterId ?? undefined,
    runNumber: dbRun.runNumber,
    startTime: new Date(dbRun.startTime),
    endTime: fromISOString(dbRun.endTime),
    duration: dbRun.duration ?? undefined,
    created: new Date(dbRun.createdAt ?? new Date().toISOString()),
    lastUpdated: new Date(dbRun.updatedAt ?? new Date().toISOString()),
  };
}

function dbRunItemToRunItem(dbRunItem: DbRunItem): RunItem {
  return {
    id: dbRunItem.id,
    runId: dbRunItem.runId,
    grailProgressId: dbRunItem.grailProgressId ?? undefined,
    name: dbRunItem.name ?? undefined,
    foundTime: new Date(dbRunItem.foundTime),
    created: new Date(dbRunItem.createdAt ?? new Date().toISOString()),
  };
}

/**
 * Main database class for managing Holy Grail tracking data.
 * Handles SQLite database operations for items, characters, progress, and settings.
 */
class GrailDatabase {
  private rawDb: Database.Database;
  private db: DrizzleDb;
  private dbPath: string;

  /**
   * Initializes the GrailDatabase instance.
   * Sets up the database connection, configures pragmas, and initializes the schema.
   * The database file is stored in the user's data directory.
   */
  constructor() {
    // Get the user data directory
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'grail.db');

    // Initialize database
    this.rawDb = new Database(this.dbPath, { timeout: 5000 }); // 5s busy timeout
    this.rawDb.pragma('journal_mode = WAL');
    this.rawDb.pragma('foreign_keys = ON');

    // Create Drizzle instance
    this.db = createDrizzleDb(this.rawDb);

    this.initializeSchema();
  }

  /**
   * Initializes the database schema by creating tables and indexes.
   * This method is called during database construction and handles schema creation errors.
   * @throws {Error} If schema initialization fails
   */
  private initializeSchema(): void {
    try {
      // Just use the inline schema for now to avoid file path issues
      this.createSchema();
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  /**
   * Creates the complete database schema including tables, indexes, triggers, and default settings.
   * This method defines the structure for items, characters, grail progress, and settings tables.
   * Also seeds the items table with Holy Grail data if it's empty.
   */
  private createSchema(): void {
    const schemaSQL = `
      -- Items table - stores all Holy Grail items
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        link TEXT,
        code TEXT,
        item_base TEXT,
        image_filename TEXT,
        type TEXT NOT NULL CHECK (type IN ('unique', 'set', 'rune', 'runeword')),
        category TEXT NOT NULL,
        sub_category TEXT NOT NULL,
        treasure_class TEXT NOT NULL,
        set_name TEXT,
        runes TEXT,
        ethereal_type TEXT NOT NULL CHECK (ethereal_type IN ('none', 'optional', 'only')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Characters table - stores character profiles
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        character_class TEXT NOT NULL CHECK (
          character_class IN (
            'amazon',
            'assassin',
            'barbarian',
            'druid',
            'necromancer',
            'paladin',
            'sorceress',
            'shared_stash'
          )
        ),
        level INTEGER NOT NULL DEFAULT 1,
        hardcore BOOLEAN NOT NULL DEFAULT FALSE,
        expansion BOOLEAN NOT NULL DEFAULT TRUE,
        save_file_path TEXT,
        deleted_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Grail progress table - tracks item discoveries per character
      CREATE TABLE IF NOT EXISTS grail_progress (
        id TEXT PRIMARY KEY,
        character_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        found_date DATETIME,
        manually_added BOOLEAN NOT NULL DEFAULT FALSE,
        auto_detected BOOLEAN NOT NULL DEFAULT TRUE,
        difficulty TEXT CHECK (difficulty IN ('normal', 'nightmare', 'hell')),
        notes TEXT,
        is_ethereal BOOLEAN NOT NULL DEFAULT FALSE,
        from_initial_scan BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );

      -- Settings table - stores user preferences
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Save file states table - tracks modification times of save files
      CREATE TABLE IF NOT EXISTS save_file_states (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,
        last_modified DATETIME NOT NULL,
        last_parsed DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Sessions table - tracks gaming sessions
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        total_run_time INTEGER DEFAULT 0, -- milliseconds
        total_session_time INTEGER DEFAULT 0, -- milliseconds
        run_count INTEGER DEFAULT 0,
        archived BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Runs table - tracks individual runs within sessions
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        character_id TEXT,
        run_number INTEGER NOT NULL, -- sequential within session
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration INTEGER, -- milliseconds
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (character_id) REFERENCES characters(id)
      );

      -- Run items table - associates items with runs
      CREATE TABLE IF NOT EXISTS run_items (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        grail_progress_id TEXT,
        name TEXT,
        found_time DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
        FOREIGN KEY (grail_progress_id) REFERENCES grail_progress(id) ON DELETE CASCADE
      );

      -- Indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
      CREATE INDEX IF NOT EXISTS idx_characters_class ON characters(character_class);
      CREATE INDEX IF NOT EXISTS idx_characters_deleted_at ON characters(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_character ON grail_progress(character_id);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_item ON grail_progress(item_id);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_found_date ON grail_progress(found_date);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_character_item ON grail_progress(character_id, item_id);
      CREATE INDEX IF NOT EXISTS idx_save_file_states_path ON save_file_states(file_path);
      CREATE INDEX IF NOT EXISTS idx_save_file_states_modified ON save_file_states(last_modified);

      -- Sessions indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_sessions_archived ON sessions(archived);

      -- Runs indexes
      CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);
      CREATE INDEX IF NOT EXISTS idx_runs_character ON runs(character_id);
      CREATE INDEX IF NOT EXISTS idx_runs_start_time ON runs(start_time);
      CREATE INDEX IF NOT EXISTS idx_runs_session_number ON runs(session_id, run_number);

      -- Run items indexes
      CREATE INDEX IF NOT EXISTS idx_run_items_run ON run_items(run_id);
      CREATE INDEX IF NOT EXISTS idx_run_items_progress ON run_items(grail_progress_id);

      -- Triggers to update the updated_at timestamp
      CREATE TRIGGER IF NOT EXISTS update_items_timestamp
        AFTER UPDATE ON items
        BEGIN
          UPDATE items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_characters_timestamp
        AFTER UPDATE ON characters
        BEGIN
          UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_grail_progress_timestamp
        AFTER UPDATE ON grail_progress
        BEGIN
          UPDATE grail_progress SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_settings_timestamp
        AFTER UPDATE ON settings
        BEGIN
          UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
        END;

      CREATE TRIGGER IF NOT EXISTS update_save_file_states_timestamp
        AFTER UPDATE ON save_file_states
        BEGIN
          UPDATE save_file_states SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp
        AFTER UPDATE ON sessions
        BEGIN
          UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_runs_timestamp
        AFTER UPDATE ON runs
        BEGIN
          UPDATE runs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      -- Insert default settings
      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('saveDir', ''),
        ('lang', 'en'),
        ('gameMode', 'both'),
        ('grailNormal', 'true'),
        ('grailEthereal', 'false'),
        ('grailRunes', 'false'),
        ('grailRunewords', 'false'),
        ('enableSounds', 'true'),
        ('notificationVolume', '0.5'),
        ('inAppNotifications', 'true'),
        ('nativeNotifications', 'true'),
        ('needsSeeding', 'true'),
        ('theme', 'system'),
        ('showItemIcons', 'false'),
        ('wizardCompleted', 'false'),
        ('wizardSkipped', 'false'),
        ('runTrackerAutoStart', 'true'),
        ('runTrackerEndThreshold', '10'),
        ('runTrackerMemoryReading', 'false'),
        ('runTrackerMemoryPollingInterval', '500');
    `;

    this.rawDb.exec(schemaSQL);
    console.log('Database schema created successfully');

    // Ensure wizard settings exist for existing databases
    this.ensureWizardSettings();

    // Always upsert items to ensure latest changes are available
    this.upsertItemsFromGrailData();
  }

  /**
   * Ensures wizard-related settings exist in the database.
   * This handles migration for existing databases that were created before wizard settings were added.
   */
  private ensureWizardSettings(): void {
    const wizardSettings = [
      { key: 'wizardCompleted', value: 'false' },
      { key: 'wizardSkipped', value: 'false' },
    ];

    for (const setting of wizardSettings) {
      this.db
        .insert(settings)
        .values({ key: setting.key, value: setting.value })
        .onConflictDoNothing()
        .run();
    }
  }

  // ============================================================================
  // Items methods
  // ============================================================================

  /**
   * Retrieves all items from the database.
   * @returns Array of all items, ordered by category, sub_category, and name
   */
  getAllItems(): Item[] {
    const dbItems = this.db
      .select()
      .from(items)
      .orderBy(asc(items.category), asc(items.subCategory), asc(items.name))
      .all();
    return dbItems.map(dbItemToItem);
  }

  /**
   * Retrieves all runewords from the database, regardless of grailRunewords setting.
   * Used by the runeword calculator to show all runewords independently of tracking settings.
   * @returns Array of all runeword items
   */
  getAllRunewords(): Item[] {
    const dbItems = this.db
      .select()
      .from(items)
      .where(eq(items.type, 'runeword'))
      .orderBy(asc(items.name))
      .all();
    return dbItems.map(dbItemToItem);
  }

  /**
   * Retrieves items filtered by current user settings.
   * @param userSettings - Current user settings for filtering items
   * @returns Array of filtered items based on settings
   */
  getFilteredItems(userSettings: Settings): Item[] {
    const allItems = this.getAllItems();
    return allItems.filter((item) => this.shouldIncludeItem(item, userSettings));
  }

  /**
   * Determines if an item should be included based on current settings.
   * Filters items by type (runes, runewords), normal items, and ethereal items.
   * @param item - The item to check
   * @param userSettings - Current user settings for filtering
   * @returns True if the item should be included, false otherwise
   */
  private shouldIncludeItem(item: Item, userSettings: Settings): boolean {
    return this.isItemTypeEnabled(item.type, userSettings);
  }

  /**
   * Checks if a specific item type is enabled in the settings.
   * @param itemType - The type of item to check (rune, runeword, etc.)
   * @param userSettings - Current user settings
   * @returns True if the item type is enabled, false otherwise
   */
  private isItemTypeEnabled(itemType: string, userSettings: Settings): boolean {
    if (itemType === 'rune' && !userSettings.grailRunes) {
      return false;
    }
    if (itemType === 'runeword' && !userSettings.grailRunewords) {
      return false;
    }
    return true;
  }

  /**
   * Inserts or updates multiple items in the database using a transaction.
   * Uses INSERT ... ON CONFLICT DO UPDATE (proper UPSERT) to safely handle duplicates
   * without triggering ON DELETE CASCADE, preserving grail_progress foreign key relationships.
   * @param itemsToInsert - Array of items to insert or update
   */
  insertItems(itemsToInsert: Item[]): void {
    const insertMany = this.rawDb.transaction(() => {
      for (const item of itemsToInsert) {
        const values = itemToDbValues(item);
        this.db
          .insert(items)
          .values(values)
          .onConflictDoUpdate({
            target: items.id,
            set: values,
          })
          .run();
      }
    });
    insertMany();
  }

  // ============================================================================
  // Characters methods
  // ============================================================================

  /**
   * Retrieves all non-deleted characters from the database.
   * @returns Array of all active characters, ordered by most recently updated
   */
  getAllCharacters(): Character[] {
    const dbChars = this.db
      .select()
      .from(characters)
      .where(isNull(characters.deletedAt))
      .orderBy(desc(characters.updatedAt))
      .all();
    return dbChars.map(dbCharacterToCharacter);
  }

  /**
   * Updates an existing character with new data.
   * @param id - The unique identifier of the character to update
   * @param updates - Partial character data to update (excluding id and timestamps)
   */
  updateCharacter(id: string, updates: Partial<Character>): void {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic update object
    const updateObj: Record<string, any> = {};

    if (updates.name !== undefined) updateObj.name = updates.name;
    if (updates.characterClass !== undefined) updateObj.characterClass = updates.characterClass;
    if (updates.level !== undefined) updateObj.level = updates.level;
    if (updates.hardcore !== undefined) updateObj.hardcore = updates.hardcore;
    if (updates.expansion !== undefined) updateObj.expansion = updates.expansion;
    if (updates.saveFilePath !== undefined) updateObj.saveFilePath = updates.saveFilePath;
    if (updates.deleted !== undefined) updateObj.deletedAt = toISOString(updates.deleted);

    if (Object.keys(updateObj).length === 0) return;

    this.db.update(characters).set(updateObj).where(eq(characters.id, id)).run();
  }

  /**
   * Inserts or updates multiple characters using a transaction.
   * Much more efficient than calling upsertCharacter() multiple times.
   * @param chars - Array of characters to upsert
   */
  upsertCharactersBatch(chars: Character[]): void {
    if (chars.length === 0) return;

    const insertMany = this.rawDb.transaction(() => {
      for (const char of chars) {
        this.db
          .insert(characters)
          .values({
            id: char.id,
            name: char.name,
            characterClass: char.characterClass,
            level: char.level,
            hardcore: char.hardcore,
            expansion: char.expansion,
            saveFilePath: char.saveFilePath ?? null,
          })
          .onConflictDoUpdate({
            target: characters.id,
            set: {
              name: char.name,
              characterClass: char.characterClass,
              level: char.level,
              hardcore: char.hardcore,
              expansion: char.expansion,
              saveFilePath: char.saveFilePath ?? null,
            },
          })
          .run();
      }
    });
    insertMany();
  }

  /**
   * Retrieves a character by its name.
   * @param name - The name of the character to find
   * @returns The character if found, undefined otherwise
   */
  getCharacterByName(name: string): Character | undefined {
    const dbChar = this.db
      .select()
      .from(characters)
      .where(and(eq(characters.name, name), isNull(characters.deletedAt)))
      .get();
    return dbChar ? dbCharacterToCharacter(dbChar) : undefined;
  }

  /**
   * Retrieves a character by its ID.
   * @param id - The ID of the character to find
   * @returns The character if found, undefined otherwise
   */
  getCharacterById(id: string): Character | undefined {
    const dbChar = this.db
      .select()
      .from(characters)
      .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
      .get();
    return dbChar ? dbCharacterToCharacter(dbChar) : undefined;
  }

  /**
   * Retrieves a character by its save file path.
   * @param saveFilePath - The save file path of the character to find
   * @returns The character if found, undefined otherwise
   */
  getCharacterBySaveFilePath(saveFilePath: string): Character | undefined {
    const dbChar = this.db
      .select()
      .from(characters)
      .where(and(eq(characters.saveFilePath, saveFilePath), isNull(characters.deletedAt)))
      .get();
    return dbChar ? dbCharacterToCharacter(dbChar) : undefined;
  }

  /**
   * Inserts a new character or updates an existing one.
   * Uses INSERT OR REPLACE to handle both insert and update operations.
   * @param character - The character data to insert or update
   */
  upsertCharacter(character: Character): void {
    this.db
      .insert(characters)
      .values({
        id: character.id,
        name: character.name,
        characterClass: character.characterClass,
        level: character.level,
        hardcore: character.hardcore,
        expansion: character.expansion,
        saveFilePath: character.saveFilePath ?? null,
      })
      .onConflictDoUpdate({
        target: characters.id,
        set: {
          name: character.name,
          characterClass: character.characterClass,
          level: character.level,
          hardcore: character.hardcore,
          expansion: character.expansion,
          saveFilePath: character.saveFilePath ?? null,
        },
      })
      .run();
  }

  // ============================================================================
  // Grail Progress methods
  // ============================================================================

  /**
   * Retrieves all grail progress records from the database.
   * @returns Array of all grail progress records, ordered by most recently updated
   */
  getAllProgress(): GrailProgress[] {
    const dbProgress = this.db
      .select()
      .from(grailProgress)
      .orderBy(desc(grailProgress.updatedAt))
      .all();
    return dbProgress.map(dbProgressToProgress);
  }

  /**
   * Retrieves grail progress records filtered by current user settings.
   * @param userSettings - Current user settings for filtering progress
   * @returns Array of filtered grail progress records based on settings
   */
  getFilteredProgress(userSettings: Settings): GrailProgress[] {
    const allProgress = this.getAllProgress();
    const filteredItems = this.getFilteredItems(userSettings);
    const filteredItemIds = new Set(filteredItems.map((item) => item.id));

    return allProgress.filter((progress) => filteredItemIds.has(progress.itemId));
  }

  /**
   * Retrieves all grail progress records for a specific character.
   * @param characterId - The unique identifier of the character
   * @returns Array of grail progress records for the specified character
   */
  getProgressByCharacter(characterId: string): GrailProgress[] {
    const dbProgress = this.db
      .select()
      .from(grailProgress)
      .where(eq(grailProgress.characterId, characterId))
      .all();
    return dbProgress.map(dbProgressToProgress);
  }

  /**
   * Retrieves all grail progress records for a specific item.
   * @param itemId - The unique identifier of the item
   * @returns Array of grail progress records for the specified item
   */
  getProgressByItem(itemId: string): GrailProgress[] {
    const dbProgress = this.db
      .select()
      .from(grailProgress)
      .where(eq(grailProgress.itemId, itemId))
      .all();
    return dbProgress.map(dbProgressToProgress);
  }

  /**
   * Retrieves a specific grail progress record for a character and item combination.
   * @param characterId - The character ID to filter by
   * @param itemId - The item ID to filter by
   * @returns The grail progress record if found, null otherwise
   */
  getCharacterProgress(characterId: string, itemId: string): GrailProgress | null {
    const dbProg = this.db
      .select()
      .from(grailProgress)
      .where(and(eq(grailProgress.characterId, characterId), eq(grailProgress.itemId, itemId)))
      .get();
    return dbProg ? dbProgressToProgress(dbProg) : null;
  }

  /**
   * Inserts a new grail progress record or updates an existing one.
   * Uses INSERT OR REPLACE to handle both insert and update operations.
   * @param progress - The grail progress data to insert or update
   */
  upsertProgress(progress: GrailProgress): void {
    this.db
      .insert(grailProgress)
      .values({
        id: progress.id,
        characterId: progress.characterId,
        itemId: progress.itemId,
        foundDate: toISOString(progress.foundDate),
        manuallyAdded: progress.manuallyAdded,
        autoDetected: true,
        difficulty: progress.difficulty ?? null,
        notes: progress.notes ?? null,
        isEthereal: progress.isEthereal,
        fromInitialScan: progress.fromInitialScan ?? false,
      })
      .onConflictDoUpdate({
        target: grailProgress.id,
        set: {
          characterId: progress.characterId,
          itemId: progress.itemId,
          foundDate: toISOString(progress.foundDate),
          manuallyAdded: progress.manuallyAdded,
          autoDetected: true,
          difficulty: progress.difficulty ?? null,
          notes: progress.notes ?? null,
          isEthereal: progress.isEthereal,
          fromInitialScan: progress.fromInitialScan ?? false,
        },
      })
      .run();
  }

  /**
   * Inserts or updates multiple grail progress entries using a transaction.
   * Much more efficient than calling upsertProgress() multiple times.
   * @param progressList - Array of progress entries to upsert
   */
  upsertProgressBatch(progressList: GrailProgress[]): void {
    if (progressList.length === 0) return;

    const insertMany = this.rawDb.transaction(() => {
      for (const progress of progressList) {
        this.db
          .insert(grailProgress)
          .values({
            id: progress.id,
            characterId: progress.characterId,
            itemId: progress.itemId,
            foundDate: toISOString(progress.foundDate),
            manuallyAdded: progress.manuallyAdded,
            autoDetected: true,
            difficulty: progress.difficulty ?? null,
            notes: progress.notes ?? null,
            isEthereal: progress.isEthereal,
            fromInitialScan: progress.fromInitialScan ?? false,
          })
          .onConflictDoUpdate({
            target: grailProgress.id,
            set: {
              characterId: progress.characterId,
              itemId: progress.itemId,
              foundDate: toISOString(progress.foundDate),
              manuallyAdded: progress.manuallyAdded,
              autoDetected: true,
              difficulty: progress.difficulty ?? null,
              notes: progress.notes ?? null,
              isEthereal: progress.isEthereal,
              fromInitialScan: progress.fromInitialScan ?? false,
            },
          })
          .run();
      }
    });
    insertMany();
  }

  // ============================================================================
  // Settings methods
  // ============================================================================

  /**
   * Retrieves all user settings from the database.
   * Converts string values back to their proper types based on the Settings interface.
   * @returns Complete Settings object with all user preferences
   */
  getAllSettings(): Settings {
    const dbSettings = this.db.select().from(settings).all();
    const settingsMap: Record<string, string> = {};
    for (const setting of dbSettings) {
      settingsMap[setting.key] = setting.value ?? '';
    }

    // Convert string values back to their proper types
    const typedSettings: Settings = {
      saveDir: settingsMap.saveDir || '',
      lang: settingsMap.lang || 'en',
      gameMode: this.parseEnumSetting(settingsMap.gameMode, GameMode.Both),
      grailNormal: this.parseBooleanSetting(settingsMap.grailNormal),
      grailEthereal: this.parseBooleanSetting(settingsMap.grailEthereal),
      grailRunes: this.parseBooleanSetting(settingsMap.grailRunes),
      grailRunewords: this.parseBooleanSetting(settingsMap.grailRunewords),
      gameVersion: this.parseEnumSetting(settingsMap.gameVersion, GameVersion.Resurrected),
      enableSounds: this.parseBooleanSetting(settingsMap.enableSounds),
      notificationVolume: this.parseFloatSetting(settingsMap.notificationVolume, 0.5) || 0.5,
      inAppNotifications: this.parseBooleanSetting(settingsMap.inAppNotifications),
      nativeNotifications: this.parseBooleanSetting(settingsMap.nativeNotifications),
      needsSeeding: this.parseBooleanSetting(settingsMap.needsSeeding),
      theme: this.parseEnumSetting(settingsMap.theme, 'system' as const),
      showItemIcons: settingsMap.showItemIcons !== 'false', // Default to true
      // D2R installation settings
      d2rInstallPath: settingsMap.d2rInstallPath || undefined,
      iconConversionStatus: settingsMap.iconConversionStatus as
        | 'not_started'
        | 'in_progress'
        | 'completed'
        | 'failed'
        | undefined,
      iconConversionProgress: this.parseJSONSetting<{ current: number; total: number }>(
        settingsMap.iconConversionProgress,
      ),
      // Advanced monitoring settings
      tickReaderIntervalMs: this.parseIntSetting(settingsMap.tickReaderIntervalMs),
      chokidarPollingIntervalMs: this.parseIntSetting(settingsMap.chokidarPollingIntervalMs),
      fileStabilityThresholdMs: this.parseIntSetting(settingsMap.fileStabilityThresholdMs),
      fileChangeDebounceMs: this.parseIntSetting(settingsMap.fileChangeDebounceMs),
      // Widget settings
      widgetEnabled: this.parseBooleanSetting(settingsMap.widgetEnabled),
      widgetDisplay: this.parseEnumSetting(settingsMap.widgetDisplay, 'overall' as const),
      widgetPosition: this.parseJSONSetting<{ x: number; y: number }>(settingsMap.widgetPosition),
      widgetOpacity: this.parseFloatSetting(settingsMap.widgetOpacity, 0.9) ?? 0.9,
      widgetSizeOverall: this.parseJSONSetting<{ width: number; height: number }>(
        settingsMap.widgetSizeOverall,
      ),
      widgetSizeSplit: this.parseJSONSetting<{ width: number; height: number }>(
        settingsMap.widgetSizeSplit,
      ),
      widgetSizeAll: this.parseJSONSetting<{ width: number; height: number }>(
        settingsMap.widgetSizeAll,
      ),
      // Main window settings
      mainWindowBounds: this.parseJSONSetting<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>(settingsMap.mainWindowBounds),
      // Wizard settings
      wizardCompleted: this.parseBooleanSetting(settingsMap.wizardCompleted),
      wizardSkipped: this.parseBooleanSetting(settingsMap.wizardSkipped),
      // Terror zone configuration
      terrorZoneConfig: this.parseJSONSetting<Record<number, boolean>>(
        settingsMap.terrorZoneConfig,
      ),
      terrorZoneBackupCreated: this.parseBooleanSetting(settingsMap.terrorZoneBackupCreated),
      // Run tracker settings
      runTrackerAutoStart: this.parseBooleanSetting(settingsMap.runTrackerAutoStart),
      runTrackerEndThreshold: this.parseIntSetting(settingsMap.runTrackerEndThreshold) ?? 10,
      runTrackerMemoryReading: this.parseBooleanSetting(settingsMap.runTrackerMemoryReading),
      runTrackerMemoryPollingInterval:
        this.parseIntSetting(settingsMap.runTrackerMemoryPollingInterval) ?? 500,
      runTrackerShortcuts: this.parseJSONSetting<Settings['runTrackerShortcuts']>(
        settingsMap.runTrackerShortcuts,
      ),
    };

    // Migration: If runTrackerAutoStart was enabled, enable runTrackerMemoryReading
    if (
      settingsMap.runTrackerAutoStart === 'true' &&
      settingsMap.runTrackerMemoryReading !== 'true'
    ) {
      console.log(
        '[Database] Migrating runTrackerAutoStart to runTrackerMemoryReading (auto mode)',
      );
      typedSettings.runTrackerMemoryReading = true;
      this.setSetting('runTrackerMemoryReading', 'true');
    }

    return typedSettings;
  }

  /**
   * Safely parses a JSON string, returning undefined if parsing fails.
   */
  private parseJSON(jsonString: string): unknown {
    if (!jsonString || jsonString === 'undefined' || jsonString === 'null') {
      return undefined;
    }
    if (jsonString === '[object Object]') {
      return undefined;
    }
    try {
      return JSON.parse(jsonString);
    } catch {
      if (jsonString !== '[object Object]') {
        console.warn(`Failed to parse JSON setting: "${jsonString}". Using undefined.`);
      }
      return undefined;
    }
  }

  private parseJSONSetting<T>(value: string | undefined): T | undefined {
    if (!value || value === '') {
      return undefined;
    }
    return this.parseJSON(value) as T | undefined;
  }

  private parseIntSetting(value: string | undefined): number | undefined {
    return value ? Number.parseInt(value, 10) : undefined;
  }

  private parseFloatSetting(value: string | undefined, defaultValue?: number): number | undefined {
    if (!value) {
      return defaultValue;
    }
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }

  private parseBooleanSetting(value: string | undefined): boolean {
    return value === 'true';
  }

  private parseEnumSetting<T>(value: string | undefined, defaultValue: T): T {
    return (value as T) || defaultValue;
  }

  /**
   * Sets a specific setting value in the database.
   * Uses INSERT OR REPLACE to handle both new and existing settings.
   * @param key - The setting key to set
   * @param value - The setting value as a string
   */
  setSetting(key: keyof Settings, value: string): void {
    this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value },
      })
      .run();
  }

  /**
   * Retrieves grail statistics filtered by current user settings.
   * @param userSettings - Current user settings for filtering statistics
   * @param characterId - Optional character ID for character-specific statistics
   * @returns Object containing filtered total items, found items, and breakdown by item type
   */
  getFilteredGrailStatistics(
    userSettings: Settings,
    characterId?: string,
  ): {
    totalItems: number;
    foundItems: number;
    uniqueItems: number;
    setItems: number;
    runes: number;
    foundUnique: number;
    foundSet: number;
    foundRunes: number;
  } {
    const filteredItems = this.getFilteredItems(userSettings);
    const filteredProgress = this.getFilteredProgress(userSettings);

    const totalItems = filteredItems.length;

    // Count items by type
    const uniqueItems = filteredItems.filter((item) => item.type === 'unique').length;
    const setItems = filteredItems.filter((item) => item.type === 'set').length;
    const runeItems = filteredItems.filter((item) => item.type === 'rune').length;

    // Count found items
    const foundProgress = characterId
      ? filteredProgress.filter((p) => p.characterId === characterId)
      : filteredProgress;

    const foundItemIds = new Set(foundProgress.map((p) => p.itemId));
    const foundItems = foundItemIds.size;

    // Count found items by type
    const foundUnique = filteredItems.filter(
      (item) => item.type === 'unique' && foundItemIds.has(item.id),
    ).length;
    const foundSet = filteredItems.filter(
      (item) => item.type === 'set' && foundItemIds.has(item.id),
    ).length;
    const foundRunes = filteredItems.filter(
      (item) => item.type === 'rune' && foundItemIds.has(item.id),
    ).length;

    return {
      totalItems,
      foundItems,
      uniqueItems,
      setItems,
      runes: runeItems,
      foundUnique,
      foundSet,
      foundRunes,
    };
  }

  // ============================================================================
  // Seeding methods
  // ============================================================================

  /**
   * Upserts all items from the Holy Grail data into the database.
   */
  upsertItemsFromGrailData(): void {
    console.log('Upserting Holy Grail item data...');
    this.insertItems(grailItemsData);
    console.log(`Upserted ${grailItemsData.length} items from Holy Grail data`);
  }

  // ============================================================================
  // Utility methods
  // ============================================================================

  /**
   * Creates a backup of the database to the specified path.
   * @param backupPath - The file path where the backup should be saved
   */
  backup(backupPath: string): void {
    this.rawDb.backup(backupPath);
  }

  /**
   * Restores the database from a backup file.
   * Closes the current connection, copies the backup file, and reopens the database.
   * @param backupPath - The file path of the backup to restore from
   */
  restore(backupPath: string): void {
    this.rawDb.close();
    copyFileSync(backupPath, this.dbPath);
    this.rawDb = new Database(this.dbPath);
    this.db = createDrizzleDb(this.rawDb);
    this.initializeSchema();
  }

  /**
   * Restores the database from a backup buffer.
   * @param backupBuffer - The buffer containing the backup data
   */
  restoreFromBuffer(backupBuffer: Buffer): void {
    this.rawDb.close();
    writeFileSync(this.dbPath, backupBuffer);
    this.rawDb = new Database(this.dbPath);
    this.db = createDrizzleDb(this.rawDb);
    this.initializeSchema();
  }

  // ============================================================================
  // Save file states methods
  // ============================================================================

  /**
   * Retrieves the save file state for a specific file path.
   * @param filePath - The path to the save file
   * @returns The save file state or null if not found
   */
  getSaveFileState(filePath: string): SaveFileState | null {
    const dbState = this.db
      .select()
      .from(saveFileStates)
      .where(eq(saveFileStates.filePath, filePath))
      .get();
    return dbState ? dbSaveFileStateToSaveFileState(dbState) : null;
  }

  /**
   * Inserts or updates a save file state in the database.
   * @param state - The save file state to store
   */
  upsertSaveFileState(state: SaveFileState): void {
    this.db
      .insert(saveFileStates)
      .values({
        id: state.id,
        filePath: state.filePath,
        lastModified: state.lastModified.toISOString(),
        lastParsed: state.lastParsed.toISOString(),
      })
      .onConflictDoUpdate({
        target: saveFileStates.id,
        set: {
          filePath: state.filePath,
          lastModified: state.lastModified.toISOString(),
          lastParsed: state.lastParsed.toISOString(),
        },
      })
      .run();
  }

  /**
   * Retrieves all save file states from the database.
   * @returns Array of all save file states
   */
  getAllSaveFileStates(): SaveFileState[] {
    const dbStates = this.db
      .select()
      .from(saveFileStates)
      .orderBy(asc(saveFileStates.filePath))
      .all();
    return dbStates.map(dbSaveFileStateToSaveFileState);
  }

  /**
   * Deletes the save file state for a specific file path.
   * @param filePath - The path to the save file
   */
  deleteSaveFileState(filePath: string): void {
    this.db.delete(saveFileStates).where(eq(saveFileStates.filePath, filePath)).run();
  }

  /**
   * Clears all save file states from the database.
   * Used when changing save directories.
   */
  clearAllSaveFileStates(): void {
    this.db.delete(saveFileStates).run();
  }

  // ============================================================================
  // Session methods
  // ============================================================================

  /**
   * Retrieves all sessions regardless of character.
   * @param includeArchived - Whether to include archived sessions (default: false)
   * @returns Array of sessions ordered by start time (most recent first)
   */
  getAllSessions(includeArchived: boolean = false): Session[] {
    let query = this.db.select().from(sessions).$dynamic();

    if (!includeArchived) {
      query = query.where(eq(sessions.archived, false));
    }

    const dbSessions = query.orderBy(desc(sessions.startTime)).all();
    return dbSessions.map(dbSessionToSession);
  }

  /**
   * Retrieves a session by ID.
   * @param sessionId - The unique identifier of the session
   * @returns The session if found, null otherwise
   */
  getSessionById(sessionId: string): Session | null {
    const dbSession = this.db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    return dbSession ? dbSessionToSession(dbSession) : null;
  }

  /**
   * Retrieves the active session (not archived, no end time).
   * @returns The active session if found, null otherwise
   */
  getActiveSession(): Session | null {
    const dbSession = this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.archived, false), isNull(sessions.endTime)))
      .orderBy(desc(sessions.startTime))
      .limit(1)
      .get();
    return dbSession ? dbSessionToSession(dbSession) : null;
  }

  /**
   * Inserts or updates a session.
   * @param session - The session data to insert or update
   */
  upsertSession(session: Session): void {
    this.db
      .insert(sessions)
      .values({
        id: session.id,
        startTime: session.startTime.toISOString(),
        endTime: toISOString(session.endTime),
        totalRunTime: session.totalRunTime,
        totalSessionTime: session.totalSessionTime,
        runCount: session.runCount,
        archived: session.archived,
        notes: session.notes ?? null,
      })
      .onConflictDoUpdate({
        target: sessions.id,
        set: {
          startTime: session.startTime.toISOString(),
          endTime: toISOString(session.endTime),
          totalRunTime: session.totalRunTime,
          totalSessionTime: session.totalSessionTime,
          runCount: session.runCount,
          archived: session.archived,
          notes: session.notes ?? null,
        },
      })
      .run();
  }

  /**
   * Archives a session.
   * @param sessionId - The unique identifier of the session to archive
   */
  archiveSession(sessionId: string): void {
    this.db.update(sessions).set({ archived: true }).where(eq(sessions.id, sessionId)).run();
  }

  /**
   * Deletes a session and all related runs (CASCADE).
   * @param sessionId - The unique identifier of the session to delete
   */
  deleteSession(sessionId: string): void {
    this.db.delete(sessions).where(eq(sessions.id, sessionId)).run();
  }

  // ============================================================================
  // Session Statistics methods
  // ============================================================================

  /**
   * Retrieves comprehensive statistics for a specific session.
   * @param sessionId - The unique identifier of the session
   * @returns Session statistics or null if session not found
   */
  getSessionStatistics(sessionId: string): SessionStats | null {
    const session = this.db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

    if (!session) {
      return null;
    }

    // Get run statistics for this session using raw SQL for aggregations
    const runStatsResult = this.rawDb
      .prepare(
        `
      SELECT
        COUNT(*) as totalRuns,
        AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE 0 END) as averageRunDuration,
        MIN(CASE WHEN duration IS NOT NULL THEN duration ELSE NULL END) as fastestRun,
        MAX(CASE WHEN duration IS NOT NULL THEN duration ELSE NULL END) as slowestRun
      FROM runs
      WHERE session_id = ?
    `,
      )
      .get(sessionId) as {
      totalRuns: number;
      averageRunDuration: number | null;
      fastestRun: number | null;
      slowestRun: number | null;
    };

    // Get item statistics for this session
    const itemStatsResult = this.rawDb
      .prepare(
        `
      SELECT
        COUNT(ri.id) as itemsFound,
        COUNT(CASE WHEN gp.from_initial_scan = 0 THEN ri.id END) as newGrailItems
      FROM run_items ri
      INNER JOIN runs r ON ri.run_id = r.id
      LEFT JOIN grail_progress gp ON ri.grail_progress_id = gp.id
      WHERE r.session_id = ?
    `,
      )
      .get(sessionId) as {
      itemsFound: number;
      newGrailItems: number;
    };

    return {
      sessionId: session.id,
      totalRuns: runStatsResult.totalRuns,
      totalTime: session.totalSessionTime ?? 0,
      totalRunTime: session.totalRunTime ?? 0,
      averageRunDuration: runStatsResult.averageRunDuration || 0,
      fastestRun: runStatsResult.fastestRun || 0,
      slowestRun: runStatsResult.slowestRun || 0,
      itemsFound: itemStatsResult.itemsFound,
      newGrailItems: itemStatsResult.newGrailItems,
    };
  }

  // ============================================================================
  // Run Statistics methods
  // ============================================================================

  /**
   * Retrieves overall run statistics across all sessions.
   * @returns Overall run statistics
   */
  getOverallRunStatistics(): RunStatistics {
    // Get session and run counts
    const sessionStatsResult = this.rawDb
      .prepare(
        `
      SELECT
        COUNT(DISTINCT s.id) as totalSessions,
        COUNT(r.id) as totalRuns,
        SUM(s.total_session_time) as totalTime
      FROM sessions s
      LEFT JOIN runs r ON s.id = r.session_id
      WHERE s.archived = 0
    `,
      )
      .get() as {
      totalSessions: number;
      totalRuns: number;
      totalTime: number | null;
    };

    // Get run duration statistics
    const runDurationResult = this.rawDb
      .prepare(
        `
      SELECT
        AVG(CASE WHEN r.duration IS NOT NULL THEN r.duration ELSE 0 END) as averageRunDuration,
        MIN(CASE WHEN r.duration IS NOT NULL THEN r.duration ELSE NULL END) as minDuration,
        MAX(CASE WHEN r.duration IS NOT NULL THEN r.duration ELSE NULL END) as maxDuration
      FROM runs r
      INNER JOIN sessions s ON r.session_id = s.id
      WHERE s.archived = 0
    `,
      )
      .get() as {
      averageRunDuration: number | null;
      minDuration: number | null;
      maxDuration: number | null;
    };

    // Get fastest run details
    const fastestRunResult = this.rawDb
      .prepare(
        `
      SELECT r.id, r.duration, r.start_time
      FROM runs r
      INNER JOIN sessions s ON r.session_id = s.id
      WHERE s.archived = 0 AND r.duration IS NOT NULL
      ORDER BY r.duration ASC
      LIMIT 1
    `,
      )
      .get() as { id: string; duration: number; start_time: string } | undefined;

    const slowestRunResult = this.rawDb
      .prepare(
        `
      SELECT r.id, r.duration, r.start_time
      FROM runs r
      INNER JOIN sessions s ON r.session_id = s.id
      WHERE s.archived = 0 AND r.duration IS NOT NULL
      ORDER BY r.duration DESC
      LIMIT 1
    `,
      )
      .get() as { id: string; duration: number; start_time: string } | undefined;

    // Get items per run average
    const itemsPerRunResult = this.rawDb
      .prepare(
        `
      SELECT
        COUNT(ri.id) as totalItems,
        COUNT(DISTINCT r.id) as runsWithItems
      FROM runs r
      INNER JOIN sessions s ON r.session_id = s.id
      LEFT JOIN run_items ri ON r.id = ri.run_id
      WHERE s.archived = 0
    `,
      )
      .get() as {
      totalItems: number;
      runsWithItems: number;
    };

    return {
      totalSessions: sessionStatsResult.totalSessions,
      totalRuns: sessionStatsResult.totalRuns,
      totalTime: sessionStatsResult.totalTime || 0,
      averageRunDuration: runDurationResult.averageRunDuration || 0,
      fastestRun: fastestRunResult
        ? {
            runId: fastestRunResult.id,
            duration: fastestRunResult.duration,
            timestamp: new Date(fastestRunResult.start_time),
          }
        : { runId: '', duration: 0, timestamp: new Date() },
      slowestRun: slowestRunResult
        ? {
            runId: slowestRunResult.id,
            duration: slowestRunResult.duration,
            timestamp: new Date(slowestRunResult.start_time),
          }
        : { runId: '', duration: 0, timestamp: new Date() },
      itemsPerRun:
        itemsPerRunResult.runsWithItems > 0
          ? itemsPerRunResult.totalItems / itemsPerRunResult.runsWithItems
          : 0,
    };
  }

  /**
   * Retrieves all runs for a session.
   * @param sessionId - The unique identifier of the session
   * @returns Array of runs ordered by run number
   */
  getRunsBySession(sessionId: string): Run[] {
    const dbRuns = this.db
      .select()
      .from(runs)
      .where(eq(runs.sessionId, sessionId))
      .orderBy(asc(runs.runNumber))
      .all();
    return dbRuns.map(dbRunToRun);
  }

  /**
   * Retrieves the active run for a session (no end time).
   * @param sessionId - The unique identifier of the session
   * @returns The active run if found, null otherwise
   */
  getActiveRun(sessionId: string): Run | null {
    const dbRun = this.db
      .select()
      .from(runs)
      .where(and(eq(runs.sessionId, sessionId), isNull(runs.endTime)))
      .orderBy(desc(runs.startTime))
      .limit(1)
      .get();
    return dbRun ? dbRunToRun(dbRun) : null;
  }

  /**
   * Inserts or updates a run.
   * @param run - The run data to insert or update
   */
  upsertRun(run: Run): void {
    this.db
      .insert(runs)
      .values({
        id: run.id,
        sessionId: run.sessionId,
        characterId: run.characterId ?? null,
        runNumber: run.runNumber,
        startTime: run.startTime.toISOString(),
        endTime: toISOString(run.endTime),
        duration: run.duration ?? null,
      })
      .onConflictDoUpdate({
        target: runs.id,
        set: {
          sessionId: run.sessionId,
          characterId: run.characterId ?? null,
          runNumber: run.runNumber,
          startTime: run.startTime.toISOString(),
          endTime: toISOString(run.endTime),
          duration: run.duration ?? null,
        },
      })
      .run();
  }

  /**
   * Deletes a run and all related items (CASCADE).
   * @param runId - The unique identifier of the run to delete
   */
  deleteRun(runId: string): void {
    this.db.delete(runs).where(eq(runs.id, runId)).run();
  }

  // ============================================================================
  // RunItem methods
  // ============================================================================

  /**
   * Retrieves all items for a run.
   * @param runId - The unique identifier of the run
   * @returns Array of run items ordered by found time
   */
  getRunItems(runId: string): RunItem[] {
    const dbItems = this.db
      .select()
      .from(runItems)
      .where(eq(runItems.runId, runId))
      .orderBy(asc(runItems.foundTime))
      .all();
    return dbItems.map(dbRunItemToRunItem);
  }

  /**
   * Retrieves all items for a session (across all runs).
   * @param sessionId - The unique identifier of the session
   * @returns Array of run items ordered by found time
   */
  getSessionItems(sessionId: string): RunItem[] {
    const dbItems = this.rawDb
      .prepare(
        `
      SELECT ri.* FROM run_items ri
      INNER JOIN runs r ON ri.run_id = r.id
      WHERE r.session_id = ?
      ORDER BY ri.found_time ASC
    `,
      )
      .all(sessionId) as DbRunItem[];
    return dbItems.map((item) => ({
      id: item.id,
      runId: item.runId,
      grailProgressId: item.grailProgressId ?? undefined,
      name: item.name ?? undefined,
      foundTime: new Date(item.foundTime),
      created: new Date(item.createdAt ?? new Date().toISOString()),
    }));
  }

  /**
   * Inserts a run item.
   * @param runItem - The run item to insert
   */
  addRunItem(runItem: RunItem): void {
    this.db
      .insert(runItems)
      .values({
        id: runItem.id,
        runId: runItem.runId,
        grailProgressId: runItem.grailProgressId ?? null,
        name: runItem.name ?? null,
        foundTime: runItem.foundTime.toISOString(),
      })
      .run();
  }

  /**
   * Inserts multiple run items in a single transaction.
   * @param items - Array of run items to insert
   */
  addRunItemsBatch(items: RunItem[]): void {
    if (items.length === 0) return;

    const insertMany = this.rawDb.transaction(() => {
      for (const item of items) {
        this.db
          .insert(runItems)
          .values({
            id: item.id,
            runId: item.runId,
            grailProgressId: item.grailProgressId ?? null,
            name: item.name ?? null,
            foundTime: item.foundTime.toISOString(),
          })
          .run();
      }
    });
    insertMany();
  }

  /**
   * Deletes a run item.
   * @param itemId - The unique identifier of the run item to delete
   */
  deleteRunItem(itemId: string): void {
    this.db.delete(runItems).where(eq(runItems.id, itemId)).run();
  }

  /**
   * Closes the database connection.
   * Should be called when the application is shutting down.
   */
  close(): void {
    this.rawDb.close();
  }

  /**
   * Truncates all user data (characters, grail progress, and save file states) from the database.
   * This removes all characters, their associated progress, and save file states while keeping items and settings.
   * @throws {Error} If the truncation operation fails
   */
  truncateUserData(): void {
    try {
      this.db.delete(characters).run();
      this.db.delete(grailProgress).run();
      this.clearAllSaveFileStates();

      console.log(
        'User data truncated: characters, grail_progress, and save_file_states tables cleared',
      );
    } catch (error) {
      console.error('Failed to truncate user data:', error);
      throw error;
    }
  }

  /**
   * Gets the file path of the database for external access.
   * @returns The absolute path to the database file
   */
  getDatabasePath(): string {
    return this.dbPath;
  }
}

const grailDatabase = new GrailDatabase();

export { GrailDatabase, grailDatabase };
