import { copyFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { app } from 'electron';
import { items } from '../items';
import type {
  Character,
  DatabaseCharacter,
  DatabaseGrailProgress,
  DatabaseItem,
  DatabaseSaveFileState,
  DatabaseSetting,
  GrailProgress,
  Item,
  SaveFileState,
  Settings,
} from '../types/grail';
import { GameMode, GameVersion } from '../types/grail';
import {
  mapCharacterToDatabase,
  mapDatabaseCharacterToCharacter,
  mapDatabaseItemToItem,
  mapDatabaseProgressToProgress,
  mapDatabaseSaveFileStateToSaveFileState,
  mapItemToDatabase,
  mapProgressToDatabase,
  mapSaveFileStateToDatabase,
  mapValuesToSqlite,
} from './mappers';

/**
 * Main database class for managing Holy Grail tracking data.
 * Handles SQLite database operations for items, characters, progress, and settings.
 */
class GrailDatabase {
  private db: Database.Database;
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
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

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
    const schema = `
      -- Items table - stores all Holy Grail items
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        link TEXT,
        code TEXT,
        item_base TEXT,
        type TEXT NOT NULL CHECK (type IN ('unique', 'set', 'rune', 'runeword')),
        category TEXT NOT NULL,
        sub_category TEXT NOT NULL,
        treasure_class TEXT NOT NULL,
        set_name TEXT,
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
        difficulty TEXT NOT NULL CHECK (difficulty IN ('normal', 'nightmare', 'hell')),
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

      -- Indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
      CREATE INDEX IF NOT EXISTS idx_characters_class ON characters(character_class);
      CREATE INDEX IF NOT EXISTS idx_characters_deleted_at ON characters(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_character ON grail_progress(character_id);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_item ON grail_progress(item_id);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_found ON grail_progress(found);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_found_date ON grail_progress(found_date);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_character_item ON grail_progress(character_id, item_id);
      CREATE INDEX IF NOT EXISTS idx_save_file_states_path ON save_file_states(file_path);
      CREATE INDEX IF NOT EXISTS idx_save_file_states_modified ON save_file_states(last_modified);

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
        ('showItemIcons', 'true');
    `;

    this.db.exec(schema);
    console.log('Database schema created successfully');

    // Check if items table is empty and seed it if needed
    const itemCount = this.db.prepare('SELECT COUNT(*) as count FROM items').get() as {
      count: number;
    };
    if (itemCount.count === 0) {
      this.seedItemsFromGrailData();
    }
  }

  // Items methods
  /**
   * Retrieves all items from the database.
   * @returns Array of all items, ordered by category, sub_category, and name
   */
  getAllItems(): Item[] {
    const stmt = this.db.prepare('SELECT * FROM items ORDER BY category, sub_category, name');
    const dbItems = stmt.all() as DatabaseItem[];
    return dbItems.map(mapDatabaseItemToItem);
  }

  /**
   * Retrieves items filtered by current user settings.
   * @param settings - Current user settings for filtering items
   * @returns Array of filtered items based on settings
   */
  getFilteredItems(settings: Settings): Item[] {
    const allItems = this.getAllItems();

    return allItems.filter((item) => this.shouldIncludeItem(item, settings));
  }

  /**
   * Determines if an item should be included based on current settings.
   * Filters items by type (runes, runewords), normal items, and ethereal items.
   * @param item - The item to check
   * @param settings - Current user settings for filtering
   * @returns True if the item should be included, false otherwise
   */
  private shouldIncludeItem(item: Item, settings: Settings): boolean {
    // Filter based on item type
    if (!this.isItemTypeEnabled(item.type, settings)) {
      return false;
    }

    return true;
  }

  /**
   * Checks if a specific item type is enabled in the settings.
   * @param itemType - The type of item to check (rune, runeword, etc.)
   * @param settings - Current user settings
   * @returns True if the item type is enabled, false otherwise
   */
  private isItemTypeEnabled(itemType: string, settings: Settings): boolean {
    if (itemType === 'rune' && !settings.grailRunes) {
      return false;
    }

    if (itemType === 'runeword' && !settings.grailRunewords) {
      return false;
    }

    return true;
  }

  /**
   * Inserts multiple items into the database using a transaction.
   * Uses INSERT OR REPLACE to handle duplicate items.
   * Only inserts base items (no eth_ duplicates).
   * @param items - Array of items to insert (without timestamps)
   */
  insertItems(items: Item[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO items (id, name, link, code, type, category, sub_category, set_name, ethereal_type, treasure_class)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((itemsToInsert: typeof items) => {
      for (const item of itemsToInsert) {
        const mappedItem = mapItemToDatabase(item);
        stmt.run(
          mappedItem.id,
          mappedItem.name,
          mappedItem.link,
          mappedItem.code,
          mappedItem.type,
          mappedItem.category,
          mappedItem.sub_category,
          mappedItem.set_name,
          mappedItem.ethereal_type,
          mappedItem.treasure_class,
        );
      }
    });

    transaction(items);
  }

  // Characters methods
  /**
   * Retrieves all non-deleted characters from the database.
   * @returns Array of all active characters, ordered by most recently updated
   */
  getAllCharacters(): Character[] {
    const stmt = this.db.prepare(
      'SELECT * FROM characters WHERE deleted_at IS NULL ORDER BY updated_at DESC',
    );
    const dbCharacters = stmt.all() as DatabaseCharacter[];
    return dbCharacters.map(mapDatabaseCharacterToCharacter);
  }

  /**
   * Updates an existing character with new data.
   * @param id - The unique identifier of the character to update
   * @param updates - Partial character data to update (excluding id and timestamps)
   */
  updateCharacter(id: string, updates: Partial<Character>): void {
    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) return;

    // Map field names from Character to database field names
    const dbFieldMap: Record<string, string> = {
      characterClass: 'character_class',
      saveFilePath: 'save_file_path',
      lastUpdated: 'updated_at',
      created: 'created_at',
      deleted: 'deleted_at',
    };

    const dbFields = fields.map((field) => dbFieldMap[field] || field);
    const setClause = dbFields.map((field) => `${field} = ?`).join(', ');
    const stmt = this.db.prepare(`UPDATE characters SET ${setClause} WHERE id = ?`);
    const mappedValues = mapValuesToSqlite(values);
    stmt.run(...mappedValues, id);
  }

  /**
   * Inserts or updates multiple characters using a transaction.
   * Much more efficient than calling upsertCharacter() multiple times.
   * @param characters - Array of characters to upsert
   */
  upsertCharactersBatch(characters: Character[]): void {
    if (characters.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO characters (id, name, character_class, level, difficulty, hardcore, expansion, save_file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((chars: Character[]) => {
      for (const character of chars) {
        const mappedCharacter = mapCharacterToDatabase({
          id: character.id,
          name: character.name,
          character_class: character.characterClass,
          level: character.level,
          difficulty: character.difficulty,
          hardcore: character.hardcore,
          expansion: character.expansion,
          save_file_path: character.saveFilePath,
        });
        stmt.run(
          mappedCharacter.id,
          mappedCharacter.name,
          mappedCharacter.character_class,
          mappedCharacter.level,
          mappedCharacter.difficulty,
          mappedCharacter.hardcore,
          mappedCharacter.expansion,
          mappedCharacter.save_file_path,
        );
      }
    });

    transaction(characters);
  }

  /**
   * Retrieves a character by its name.
   * @param name - The name of the character to find
   * @returns The character if found, undefined otherwise
   */
  getCharacterByName(name: string): Character | undefined {
    const stmt = this.db.prepare('SELECT * FROM characters WHERE name = ? AND deleted_at IS NULL');
    const dbCharacter = stmt.get(name) as DatabaseCharacter | undefined;
    return dbCharacter ? mapDatabaseCharacterToCharacter(dbCharacter) : undefined;
  }

  /**
   * Retrieves a character by its save file path.
   * @param saveFilePath - The save file path of the character to find
   * @returns The character if found, undefined otherwise
   */
  getCharacterBySaveFilePath(saveFilePath: string): Character | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM characters WHERE save_file_path = ? AND deleted_at IS NULL',
    );
    const dbCharacter = stmt.get(saveFilePath) as DatabaseCharacter | undefined;
    return dbCharacter ? mapDatabaseCharacterToCharacter(dbCharacter) : undefined;
  }

  /**
   * Inserts a new character or updates an existing one.
   * Uses INSERT OR REPLACE to handle both insert and update operations.
   * @param character - The character data to insert or update
   */
  upsertCharacter(character: Character): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO characters (id, name, character_class, level, difficulty, hardcore, expansion, save_file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const mappedCharacter = mapCharacterToDatabase({
      id: character.id,
      name: character.name,
      character_class: character.characterClass,
      level: character.level,
      difficulty: character.difficulty,
      hardcore: character.hardcore,
      expansion: character.expansion,
      save_file_path: character.saveFilePath,
    });
    stmt.run(
      mappedCharacter.id,
      mappedCharacter.name,
      mappedCharacter.character_class,
      mappedCharacter.level,
      mappedCharacter.difficulty,
      mappedCharacter.hardcore,
      mappedCharacter.expansion,
      mappedCharacter.save_file_path,
    );
  }

  // Grail Progress methods
  /**
   * Retrieves all grail progress records from the database.
   * @returns Array of all grail progress records, ordered by most recently updated
   */
  getAllProgress(): GrailProgress[] {
    const stmt = this.db.prepare('SELECT * FROM grail_progress ORDER BY updated_at DESC');
    const dbProgress = stmt.all() as DatabaseGrailProgress[];
    return dbProgress.map(mapDatabaseProgressToProgress);
  }

  /**
   * Retrieves grail progress records filtered by current user settings.
   * @param settings - Current user settings for filtering progress
   * @returns Array of filtered grail progress records based on settings
   */
  getFilteredProgress(settings: Settings): GrailProgress[] {
    const allProgress = this.getAllProgress();
    const filteredItems = this.getFilteredItems(settings);
    const filteredItemIds = new Set(filteredItems.map((item) => item.id));

    return allProgress.filter((progress) => filteredItemIds.has(progress.itemId));
  }

  /**
   * Retrieves all grail progress records for a specific character.
   * @param characterId - The unique identifier of the character
   * @returns Array of grail progress records for the specified character
   */
  getProgressByCharacter(characterId: string): GrailProgress[] {
    const stmt = this.db.prepare('SELECT * FROM grail_progress WHERE character_id = ?');
    const dbProgress = stmt.all(characterId) as DatabaseGrailProgress[];
    return dbProgress.map(mapDatabaseProgressToProgress);
  }

  /**
   * Retrieves all grail progress records for a specific item.
   * @param itemId - The unique identifier of the item
   * @returns Array of grail progress records for the specified item
   */
  getProgressByItem(itemId: string): GrailProgress[] {
    const stmt = this.db.prepare('SELECT * FROM grail_progress WHERE item_id = ?');
    const dbProgress = stmt.all(itemId) as DatabaseGrailProgress[];
    return dbProgress.map(mapDatabaseProgressToProgress);
  }

  /**
   * Retrieves a specific grail progress record for a character and item combination.
   * @param characterId - The character ID to filter by
   * @param itemId - The item ID to filter by
   * @returns The grail progress record if found, null otherwise
   */
  getCharacterProgress(characterId: string, itemId: string): GrailProgress | null {
    const stmt = this.db.prepare(
      'SELECT * FROM grail_progress WHERE character_id = ? AND item_id = ?',
    );
    const dbProgress = stmt.get(characterId, itemId) as DatabaseGrailProgress | undefined;
    return dbProgress ? mapDatabaseProgressToProgress(dbProgress) : null;
  }

  /**
   * Inserts a new grail progress record or updates an existing one.
   * Uses INSERT OR REPLACE to handle both insert and update operations.
   * @param progress - The grail progress data to insert or update
   */
  upsertProgress(progress: GrailProgress): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO grail_progress (id, character_id, item_id, found_date, manually_added, auto_detected, difficulty, notes, is_ethereal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const mappedProgress = mapProgressToDatabase(progress);
    stmt.run(
      mappedProgress.id,
      mappedProgress.character_id,
      mappedProgress.item_id,
      mappedProgress.found_date,
      mappedProgress.manually_added,
      mappedProgress.auto_detected,
      mappedProgress.difficulty,
      mappedProgress.notes,
      mappedProgress.is_ethereal,
    );
  }

  /**
   * Inserts or updates multiple grail progress entries using a transaction.
   * Much more efficient than calling upsertProgress() multiple times.
   * @param progressList - Array of progress entries to upsert
   */
  upsertProgressBatch(progressList: GrailProgress[]): void {
    if (progressList.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO grail_progress (id, character_id, item_id, found_date, manually_added, auto_detected, difficulty, notes, is_ethereal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((progList: GrailProgress[]) => {
      for (const progress of progList) {
        const mappedProgress = mapProgressToDatabase(progress);
        stmt.run(
          mappedProgress.id,
          mappedProgress.character_id,
          mappedProgress.item_id,
          mappedProgress.found_date,
          mappedProgress.manually_added,
          mappedProgress.auto_detected,
          mappedProgress.difficulty,
          mappedProgress.notes,
          mappedProgress.is_ethereal,
        );
      }
    });

    transaction(progressList);
  }

  // Settings methods
  /**
   * Retrieves all user settings from the database.
   * Converts string values back to their proper types based on the Settings interface.
   * @returns Complete Settings object with all user preferences
   */
  getAllSettings(): Settings {
    const stmt = this.db.prepare('SELECT * FROM settings');
    const settings: Record<string, string> = {};
    (stmt.all() as DatabaseSetting[]).forEach((setting) => {
      settings[setting.key] = setting.value || '';
    });

    // Convert string values back to their proper types
    const typedSettings: Settings = {
      saveDir: settings.saveDir || '',
      lang: settings.lang || 'en',
      gameMode: (settings.gameMode as GameMode) || GameMode.Both,
      grailNormal: settings.grailNormal === 'true',
      grailEthereal: settings.grailEthereal === 'true',
      grailRunes: settings.grailRunes === 'true',
      grailRunewords: settings.grailRunewords === 'true',
      gameVersion: (settings.gameVersion as GameVersion) || GameVersion.Resurrected,
      enableSounds: settings.enableSounds === 'true',
      notificationVolume: Number.parseFloat(settings.notificationVolume) || 0.5,
      inAppNotifications: settings.inAppNotifications === 'true',
      nativeNotifications: settings.nativeNotifications === 'true',
      needsSeeding: settings.needsSeeding === 'true',
      theme: (settings.theme as 'light' | 'dark' | 'system') || 'system',
      showItemIcons: settings.showItemIcons !== 'false', // Default to true
    };

    return typedSettings;
  }

  /**
   * Sets a specific setting value in the database.
   * Uses INSERT OR REPLACE to handle both new and existing settings.
   * @param key - The setting key to set
   * @param value - The setting value as a string
   */
  setSetting(key: keyof Settings, value: string): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    stmt.run(key, value);
  }

  /**
   * Retrieves grail statistics filtered by current user settings.
   * @param settings - Current user settings for filtering statistics
   * @param characterId - Optional character ID for character-specific statistics. If not provided, returns global statistics.
   * @returns Object containing filtered total items, found items, and breakdown by item type
   */
  getFilteredGrailStatistics(
    settings: Settings,
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
    const filteredItems = this.getFilteredItems(settings);
    const filteredProgress = this.getFilteredProgress(settings);

    const totalItems = filteredItems.length;

    // Count items by type
    const uniqueItems = filteredItems.filter((item) => item.type === 'unique').length;
    const setItems = filteredItems.filter((item) => item.type === 'set').length;
    const runes = filteredItems.filter((item) => item.type === 'rune').length;

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
      runes,
      foundUnique,
      foundSet,
      foundRunes,
    };
  }

  // Seeding methods
  /**
   * Seeds the items table with Holy Grail data from the grail module.
   * Clears existing items and populates with both regular and ethereal versions.
   */
  seedItemsFromGrailData(): void {
    console.log('Starting Holy Grail data seeding...');

    // Clear existing items
    this.db.prepare('DELETE FROM items').run();

    // Insert all items
    this.insertItems(items);

    console.log(`Seeded ${items.length} items from Holy Grail data`);
  }

  // Utility methods
  /**
   * Creates a backup of the database to the specified path.
   * @param backupPath - The file path where the backup should be saved
   */
  backup(backupPath: string): void {
    this.db.backup(backupPath);
  }

  /**
   * Restores the database from a backup file.
   * Closes the current connection, copies the backup file, and reopens the database.
   * @param backupPath - The file path of the backup to restore from
   */
  restore(backupPath: string): void {
    // Close current database connection
    this.db.close();

    // Copy backup file to current database location
    copyFileSync(backupPath, this.dbPath);

    // Reopen database connection
    this.db = new Database(this.dbPath);
    this.initializeSchema();
  }

  /**
   * Restores the database from a backup buffer.
   * Closes the current connection, writes the buffer to the database file, and reopens the database.
   * @param backupBuffer - The buffer containing the backup data
   */
  restoreFromBuffer(backupBuffer: Buffer): void {
    // Close current database connection
    this.db.close();

    // Write backup buffer to current database location
    writeFileSync(this.dbPath, backupBuffer);

    // Reopen database connection
    this.db = new Database(this.dbPath);
    this.initializeSchema();
  }

  // Save file states methods
  /**
   * Retrieves the save file state for a specific file path.
   * @param filePath - The path to the save file
   * @returns The save file state or null if not found
   */
  getSaveFileState(filePath: string): SaveFileState | null {
    const stmt = this.db.prepare('SELECT * FROM save_file_states WHERE file_path = ?');
    const dbState = stmt.get(filePath) as DatabaseSaveFileState | undefined;
    return dbState ? mapDatabaseSaveFileStateToSaveFileState(dbState) : null;
  }

  /**
   * Inserts or updates a save file state in the database.
   * @param state - The save file state to store
   */
  upsertSaveFileState(state: SaveFileState): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO save_file_states (id, file_path, last_modified, last_parsed)
      VALUES (?, ?, ?, ?)
    `);
    const mappedState = mapSaveFileStateToDatabase(state);
    stmt.run(
      mappedState.id,
      mappedState.file_path,
      mappedState.last_modified,
      mappedState.last_parsed,
    );
  }

  /**
   * Retrieves all save file states from the database.
   * @returns Array of all save file states
   */
  getAllSaveFileStates(): SaveFileState[] {
    const stmt = this.db.prepare('SELECT * FROM save_file_states ORDER BY file_path');
    const dbStates = stmt.all() as DatabaseSaveFileState[];
    return dbStates.map(mapDatabaseSaveFileStateToSaveFileState);
  }

  /**
   * Deletes the save file state for a specific file path.
   * @param filePath - The path to the save file
   */
  deleteSaveFileState(filePath: string): void {
    const stmt = this.db.prepare('DELETE FROM save_file_states WHERE file_path = ?');
    stmt.run(filePath);
  }

  /**
   * Clears all save file states from the database.
   * Used when changing save directories.
   */
  clearAllSaveFileStates(): void {
    this.db.prepare('DELETE FROM save_file_states').run();
  }

  /**
   * Closes the database connection.
   * Should be called when the application is shutting down.
   */
  close(): void {
    this.db.close();
  }

  /**
   * Truncates all user data (characters, grail progress, and save file states) from the database.
   * This removes all characters, their associated progress, and save file states while keeping items and settings.
   * @throws {Error} If the truncation operation fails
   */
  truncateUserData(): void {
    try {
      // Delete all characters
      this.db.prepare('DELETE FROM characters').run();

      // Delete all grail progress
      this.db.prepare('DELETE FROM grail_progress').run();

      // Clear all save file states (when directory changes)
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
export type { DatabaseCharacter, DatabaseGrailProgress, DatabaseItem, DatabaseSetting };
