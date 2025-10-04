import { copyFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { app } from 'electron';
import { items } from '../items';
import type {
  DatabaseCharacter,
  DatabaseGrailProgress,
  DatabaseItem,
  DatabaseSetting,
  Item,
  Settings,
} from '../types/grail';
import { GameMode, GameVersion } from '../types/grail';

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
      this.createBasicSchema();
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
  private createBasicSchema(): void {
    const schema = `
      -- Items table - stores all Holy Grail items
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        link TEXT,
        code TEXT,
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
            'sorceress'
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
        found BOOLEAN NOT NULL DEFAULT FALSE,
        found_date DATETIME,
        manually_added BOOLEAN NOT NULL DEFAULT FALSE,
        auto_detected BOOLEAN NOT NULL DEFAULT TRUE,
        difficulty TEXT CHECK (difficulty IN ('normal', 'nightmare', 'hell')),
        notes TEXT,
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
   * @returns Array of all database items, ordered by category, sub_category, and name
   */
  getAllItems(): DatabaseItem[] {
    const stmt = this.db.prepare('SELECT * FROM items ORDER BY category, sub_category, name');
    return stmt.all() as DatabaseItem[];
  }

  /**
   * Retrieves items filtered by current user settings.
   * @param settings - Current user settings for filtering items
   * @returns Array of filtered database items based on settings
   */
  getFilteredItems(settings: Settings): DatabaseItem[] {
    const allItems = this.getAllItems();

    return allItems.filter((item) => this.shouldIncludeItem(item, settings));
  }

  /**
   * Determines if an item should be included based on current settings.
   * Filters items by type (runes, runewords), normal items, and ethereal items.
   * @param item - The database item to check
   * @param settings - Current user settings for filtering
   * @returns True if the item should be included, false otherwise
   */
  private shouldIncludeItem(item: DatabaseItem, settings: Settings): boolean {
    // Filter based on item type
    if (!this.isItemTypeEnabled(item.type, settings)) {
      return false;
    }

    if (!this.isNormalTypeEnabled(item, settings)) {
      return false;
    }

    // Filter based on ethereal type
    if (!this.isEtherealTypeEnabled(item, settings)) {
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
   * Checks if normal (non-ethereal) items are enabled in the settings.
   * @param item - The database item to check
   * @param settings - Current user settings
   * @returns True if normal items are enabled, false otherwise
   */
  private isNormalTypeEnabled(item: DatabaseItem, settings: Settings): boolean {
    if (!item.id.startsWith('eth_') && !settings.grailNormal) {
      return false;
    }
    return true;
  }

  /**
   * Checks if ethereal items are enabled in the settings.
   * @param item - The database item to check
   * @param settings - Current user settings
   * @returns True if ethereal items are enabled, false otherwise
   */
  private isEtherealTypeEnabled(item: DatabaseItem, settings: Settings): boolean {
    if (item.id.startsWith('eth_') && !settings.grailEthereal) {
      return false;
    }

    return true;
  }

  /**
   * Retrieves a specific item by its ID.
   * @param id - The unique identifier of the item
   * @returns The database item if found, undefined otherwise
   */
  getItemById(id: string): DatabaseItem | undefined {
    const stmt = this.db.prepare('SELECT * FROM items WHERE id = ?');
    return stmt.get(id) as DatabaseItem | undefined;
  }

  /**
   * Inserts a single item into the database.
   * @param item - The item to insert (without timestamps)
   */
  insertItem(item: Omit<DatabaseItem, 'created_at' | 'updated_at'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO items (id, name, link, code, type, category, sub_category, set_name, ethereal_type, treasure_class)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      item.id,
      item.name,
      item.link,
      item.code,
      item.type,
      item.category,
      item.sub_category,
      item.set_name,
      item.ethereal_type,
      item.treasure_class,
    );
  }

  /**
   * Inserts multiple items into the database using a transaction.
   * Uses INSERT OR REPLACE to handle duplicate items.
   * @param items - Array of items to insert (without timestamps)
   */
  insertItems(items: Item[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO items (id, name, link, code, type, category, sub_category, set_name, ethereal_type, treasure_class)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((itemsToInsert: typeof items) => {
      for (const item of itemsToInsert) {
        if (item.etherealType === 'none' || item.etherealType === 'optional') {
          stmt.run(
            item.id,
            item.name,
            item.link,
            item.code,
            item.type,
            item.category,
            item.subCategory,
            item.setName,
            item.etherealType,
            item.treasureClass,
          );
        }
        if (item.etherealType === 'only' || item.etherealType === 'optional') {
          stmt.run(
            `eth_${item.id}`,
            item.name,
            item.link,
            item.code,
            item.type,
            item.category,
            item.subCategory,
            item.setName,
            item.etherealType,
            item.treasureClass,
          );
        }
      }
    });

    transaction(items);
  }

  // Characters methods
  /**
   * Retrieves all non-deleted characters from the database.
   * @returns Array of all active characters, ordered by most recently updated
   */
  getAllCharacters(): DatabaseCharacter[] {
    const stmt = this.db.prepare(
      'SELECT * FROM characters WHERE deleted_at IS NULL ORDER BY updated_at DESC',
    );
    return stmt.all() as DatabaseCharacter[];
  }

  /**
   * Retrieves a specific character by its ID.
   * @param id - The unique identifier of the character
   * @returns The database character if found, undefined otherwise
   */
  getCharacterById(id: string): DatabaseCharacter | undefined {
    const stmt = this.db.prepare('SELECT * FROM characters WHERE id = ?');
    return stmt.get(id) as DatabaseCharacter | undefined;
  }

  /**
   * Inserts a new character into the database.
   * @param character - The character data to insert (without timestamps and deleted_at)
   */
  insertCharacter(
    character: Omit<DatabaseCharacter, 'created_at' | 'updated_at' | 'deleted_at'>,
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO characters (id, name, character_class, level, difficulty, hardcore, expansion, save_file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      character.id,
      character.name,
      character.character_class,
      character.level,
      character.difficulty,
      character.hardcore,
      character.expansion,
      character.save_file_path,
    );
  }

  /**
   * Updates an existing character with new data.
   * @param id - The unique identifier of the character to update
   * @param updates - Partial character data to update (excluding id and timestamps)
   */
  updateCharacter(
    id: string,
    updates: Partial<Omit<DatabaseCharacter, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>,
  ): void {
    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) return;

    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    const stmt = this.db.prepare(`UPDATE characters SET ${setClause} WHERE id = ?`);
    stmt.run(...values, id);
  }

  /**
   * Soft deletes a character by setting the deleted_at timestamp.
   * @param id - The unique identifier of the character to delete
   */
  deleteCharacter(id: string): void {
    // Soft delete by setting deleted_at timestamp
    const stmt = this.db.prepare(
      'UPDATE characters SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
    );
    stmt.run(id);
  }

  /**
   * Retrieves a character by its name.
   * @param name - The name of the character to find
   * @returns The database character if found, undefined otherwise
   */
  getCharacterByName(name: string): DatabaseCharacter | undefined {
    const stmt = this.db.prepare('SELECT * FROM characters WHERE name = ? AND deleted_at IS NULL');
    return stmt.get(name) as DatabaseCharacter | undefined;
  }

  /**
   * Retrieves a character by its save file path.
   * @param saveFilePath - The save file path of the character to find
   * @returns The database character if found, undefined otherwise
   */
  getCharacterBySaveFilePath(saveFilePath: string): DatabaseCharacter | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM characters WHERE save_file_path = ? AND deleted_at IS NULL',
    );
    return stmt.get(saveFilePath) as DatabaseCharacter | undefined;
  }

  /**
   * Inserts a new character or updates an existing one.
   * Uses INSERT OR REPLACE to handle both insert and update operations.
   * @param character - The character data to insert or update (without timestamps and deleted_at)
   */
  upsertCharacter(
    character: Omit<DatabaseCharacter, 'created_at' | 'updated_at' | 'deleted_at'>,
  ): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO characters (id, name, character_class, level, difficulty, hardcore, expansion, save_file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      character.id,
      character.name,
      character.character_class,
      character.level,
      character.difficulty,
      character.hardcore,
      character.expansion,
      character.save_file_path,
    );
  }

  // Grail Progress methods
  /**
   * Retrieves all grail progress records from the database.
   * @returns Array of all grail progress records, ordered by most recently updated
   */
  getAllProgress(): DatabaseGrailProgress[] {
    const stmt = this.db.prepare('SELECT * FROM grail_progress ORDER BY updated_at DESC');
    return stmt.all() as DatabaseGrailProgress[];
  }

  /**
   * Retrieves grail progress records filtered by current user settings.
   * @param settings - Current user settings for filtering progress
   * @returns Array of filtered grail progress records based on settings
   */
  getFilteredProgress(settings: Settings): DatabaseGrailProgress[] {
    const allProgress = this.getAllProgress();
    const filteredItems = this.getFilteredItems(settings);
    const filteredItemIds = new Set(filteredItems.map((item) => item.id));

    // Also include ethereal versions of items if ethereal is enabled
    if (settings.grailEthereal) {
      filteredItems.forEach((item) => {
        if (item.ethereal_type === 'optional' || item.ethereal_type === 'only') {
          filteredItemIds.add(`eth_${item.id}`);
        }
      });
    }

    return allProgress.filter((progress) => filteredItemIds.has(progress.item_id));
  }

  /**
   * Retrieves all grail progress records for a specific character.
   * @param characterId - The unique identifier of the character
   * @returns Array of grail progress records for the specified character
   */
  getProgressByCharacter(characterId: string): DatabaseGrailProgress[] {
    const stmt = this.db.prepare('SELECT * FROM grail_progress WHERE character_id = ?');
    return stmt.all(characterId) as DatabaseGrailProgress[];
  }

  /**
   * Retrieves all grail progress records for a specific item.
   * @param itemId - The unique identifier of the item
   * @returns Array of grail progress records for the specified item
   */
  getProgressByItem(itemId: string): DatabaseGrailProgress[] {
    const stmt = this.db.prepare('SELECT * FROM grail_progress WHERE item_id = ?');
    return stmt.all(itemId) as DatabaseGrailProgress[];
  }

  /**
   * Inserts a new grail progress record or updates an existing one.
   * Uses INSERT OR REPLACE to handle both insert and update operations.
   * @param progress - The grail progress data to insert or update (without timestamps)
   */
  upsertProgress(progress: Omit<DatabaseGrailProgress, 'created_at' | 'updated_at'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO grail_progress (id, character_id, item_id, found, found_date, manually_added, auto_detected, difficulty, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      progress.id,
      progress.character_id,
      progress.item_id,
      progress.found,
      progress.found_date,
      progress.manually_added,
      progress.auto_detected,
      progress.difficulty,
      progress.notes,
    );
  }

  /**
   * Deletes a grail progress record for a specific character and item combination.
   * @param characterId - The unique identifier of the character
   * @param itemId - The unique identifier of the item
   */
  deleteProgress(characterId: string, itemId: string): void {
    const stmt = this.db.prepare(
      'DELETE FROM grail_progress WHERE character_id = ? AND item_id = ?',
    );
    stmt.run(characterId, itemId);
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
   * Retrieves a specific setting value by its key.
   * @param key - The setting key to retrieve
   * @returns The setting value as a string, or undefined if not found
   */
  getSetting(key: keyof Settings): string | undefined {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value;
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

  // Statistics methods
  /**
   * Retrieves comprehensive grail statistics for a character or globally.
   * @param characterId - Optional character ID for character-specific statistics. If not provided, returns global statistics.
   * @returns Object containing total items, found items, and breakdown by item type
   */
  getGrailStatistics(characterId?: string): {
    totalItems: number;
    foundItems: number;
    uniqueItems: number;
    setItems: number;
    runes: number;
    foundUnique: number;
    foundSet: number;
    foundRunes: number;
  } {
    let totalItems: number;
    let foundItems: number;
    let uniqueItems: number;
    let setItems: number;
    let runes: number;
    let foundUnique: number;
    let foundSet: number;
    let foundRunes: number;

    if (characterId) {
      // Character-specific statistics
      const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM items');
      const foundStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM grail_progress
        WHERE character_id = ? AND found = 1
      `);
      const typeStmt = this.db.prepare('SELECT type, COUNT(*) as count FROM items GROUP BY type');
      const foundTypeStmt = this.db.prepare(`
        SELECT i.type, COUNT(*) as count
        FROM grail_progress gp
        JOIN items i ON gp.item_id = i.id
        WHERE gp.character_id = ? AND gp.found = 1
        GROUP BY i.type
      `);

      totalItems = (totalStmt.get() as { count: number }).count;
      foundItems = (foundStmt.get(characterId) as { count: number }).count;

      const typeResults = typeStmt.all() as { type: string; count: number }[];
      const foundTypeResults = foundTypeStmt.all(characterId) as { type: string; count: number }[];

      uniqueItems = typeResults.find((r) => r.type === 'unique')?.count || 0;
      setItems = typeResults.find((r) => r.type === 'set')?.count || 0;
      runes = typeResults.find((r) => r.type === 'rune')?.count || 0;

      foundUnique = foundTypeResults.find((r) => r.type === 'unique')?.count || 0;
      foundSet = foundTypeResults.find((r) => r.type === 'set')?.count || 0;
      foundRunes = foundTypeResults.find((r) => r.type === 'rune')?.count || 0;
    } else {
      // Global statistics
      const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM items');
      const typeStmt = this.db.prepare('SELECT type, COUNT(*) as count FROM items GROUP BY type');

      totalItems = (totalStmt.get() as { count: number }).count;
      foundItems = 0; // Global found items would need more complex logic

      const typeResults = typeStmt.all() as { type: string; count: number }[];

      uniqueItems = typeResults.find((r) => r.type === 'unique')?.count || 0;
      setItems = typeResults.find((r) => r.type === 'set')?.count || 0;
      runes = typeResults.find((r) => r.type === 'rune')?.count || 0;

      foundUnique = 0;
      foundSet = 0;
      foundRunes = 0;
    }

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
      ? filteredProgress.filter((p) => p.character_id === characterId && p.found)
      : filteredProgress.filter((p) => p.found);

    const foundItemIds = new Set(foundProgress.map((p) => p.item_id));
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

  /**
   * Closes the database connection.
   * Should be called when the application is shutting down.
   */
  close(): void {
    this.db.close();
  }

  /**
   * Truncates all user data (characters and grail progress) from the database.
   * This removes all characters and their associated progress while keeping items and settings.
   * @throws {Error} If the truncation operation fails
   */
  truncateUserData(): void {
    try {
      // Delete all characters
      this.db.prepare('DELETE FROM characters').run();

      // Delete all grail progress
      this.db.prepare('DELETE FROM grail_progress').run();

      console.log('User data truncated: characters and grail_progress tables cleared');
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
