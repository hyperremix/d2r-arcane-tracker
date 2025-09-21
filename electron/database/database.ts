import { copyFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { IEthGrailData } from 'd2-holy-grail/client/src/common/definitions/union/IEthGrailData';
import type { IHolyGrailData } from 'd2-holy-grail/client/src/common/definitions/union/IHolyGrailData';
import { app } from 'electron';
import { getHolyGrailSeedData } from '../items/grail';
import type { EtherealType, Settings } from '../types/grail';
import { GameMode, GameVersion } from '../types/grail';

// Type definitions for grail data structure
type GrailItems = Record<string, Record<string, unknown>>;
type GrailTiers = Record<string, GrailItems>;
type GrailCategory = Record<string, unknown>;
type GrailData = IHolyGrailData | IEthGrailData;

interface DatabaseItem {
  id: string;
  name: string;
  type: 'unique' | 'set' | 'rune' | 'runeword';
  category: string;
  sub_category: string;
  set_name?: string;
  ethereal_type: EtherealType;
  created_at: string;
  updated_at: string;
}

interface DatabaseCharacter {
  id: string;
  name: string;
  character_class: string;
  level: number;
  difficulty: 'normal' | 'nightmare' | 'hell';
  hardcore: boolean;
  expansion: boolean;
  save_file_path?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

interface DatabaseGrailProgress {
  id: string;
  character_id: string;
  item_id: string;
  found: boolean;
  found_date?: string;
  manually_added: boolean;
  auto_detected: boolean;
  difficulty?: 'normal' | 'nightmare' | 'hell';
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface DatabaseSetting {
  key: string;
  value: string | null;
  updated_at: string;
}

class GrailDatabase {
  private db: Database.Database;
  private dbPath: string;

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

  private initializeSchema(): void {
    try {
      // Just use the inline schema for now to avoid file path issues
      this.createBasicSchema();
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  private createBasicSchema(): void {
    const schema = `
      -- Items table - stores all Holy Grail items
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('unique', 'set', 'rune', 'runeword')),
        category TEXT NOT NULL,
        sub_category TEXT NOT NULL,
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
        ('gameVersion', 'Resurrected'),
        ('enableSounds', 'true'),
        ('notificationVolume', '0.5'),
        ('inAppNotifications', 'true'),
        ('nativeNotifications', 'true'),
        ('needsSeeding', 'true');
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
  getAllItems(): DatabaseItem[] {
    const stmt = this.db.prepare('SELECT * FROM items ORDER BY category, sub_category, name');
    return stmt.all() as DatabaseItem[];
  }

  getFilteredItems(settings: Settings): DatabaseItem[] {
    const allItems = this.getAllItems();

    return allItems.filter((item) => this.shouldIncludeItem(item, settings));
  }

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

  private isItemTypeEnabled(itemType: string, settings: Settings): boolean {
    if (itemType === 'rune' && !settings.grailRunes) {
      return false;
    }

    if (itemType === 'runeword' && !settings.grailRunewords) {
      return false;
    }

    return true;
  }

  private isNormalTypeEnabled(item: DatabaseItem, settings: Settings): boolean {
    if (!item.id.startsWith('eth_') && !settings.grailNormal) {
      return false;
    }
    return true;
  }

  private isEtherealTypeEnabled(item: DatabaseItem, settings: Settings): boolean {
    if (item.id.startsWith('eth_') && !settings.grailEthereal) {
      return false;
    }

    return true;
  }

  getItemById(id: string): DatabaseItem | undefined {
    const stmt = this.db.prepare('SELECT * FROM items WHERE id = ?');
    return stmt.get(id) as DatabaseItem | undefined;
  }

  insertItem(item: Omit<DatabaseItem, 'created_at' | 'updated_at'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO items (id, name, type, category, sub_category, set_name, ethereal_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      item.id,
      item.name,
      item.type,
      item.category,
      item.sub_category,
      item.set_name,
      item.ethereal_type,
    );
  }

  insertItems(items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO items (id, name, type, category, sub_category, set_name, ethereal_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((itemsToInsert: typeof items) => {
      for (const item of itemsToInsert) {
        stmt.run(
          item.id,
          item.name,
          item.type,
          item.category,
          item.sub_category,
          item.set_name,
          item.ethereal_type,
        );
      }
    });

    transaction(items);
  }

  // Characters methods
  getAllCharacters(): DatabaseCharacter[] {
    const stmt = this.db.prepare(
      'SELECT * FROM characters WHERE deleted_at IS NULL ORDER BY updated_at DESC',
    );
    return stmt.all() as DatabaseCharacter[];
  }

  getCharacterById(id: string): DatabaseCharacter | undefined {
    const stmt = this.db.prepare('SELECT * FROM characters WHERE id = ?');
    return stmt.get(id) as DatabaseCharacter | undefined;
  }

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

  deleteCharacter(id: string): void {
    // Soft delete by setting deleted_at timestamp
    const stmt = this.db.prepare(
      'UPDATE characters SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
    );
    stmt.run(id);
  }

  getCharacterByName(name: string): DatabaseCharacter | undefined {
    const stmt = this.db.prepare('SELECT * FROM characters WHERE name = ? AND deleted_at IS NULL');
    return stmt.get(name) as DatabaseCharacter | undefined;
  }

  getCharacterBySaveFilePath(saveFilePath: string): DatabaseCharacter | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM characters WHERE save_file_path = ? AND deleted_at IS NULL',
    );
    return stmt.get(saveFilePath) as DatabaseCharacter | undefined;
  }

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
  getAllProgress(): DatabaseGrailProgress[] {
    const stmt = this.db.prepare('SELECT * FROM grail_progress ORDER BY updated_at DESC');
    return stmt.all() as DatabaseGrailProgress[];
  }

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

  getProgressByCharacter(characterId: string): DatabaseGrailProgress[] {
    const stmt = this.db.prepare('SELECT * FROM grail_progress WHERE character_id = ?');
    return stmt.all(characterId) as DatabaseGrailProgress[];
  }

  getProgressByItem(itemId: string): DatabaseGrailProgress[] {
    const stmt = this.db.prepare('SELECT * FROM grail_progress WHERE item_id = ?');
    return stmt.all(itemId) as DatabaseGrailProgress[];
  }

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

  deleteProgress(characterId: string, itemId: string): void {
    const stmt = this.db.prepare(
      'DELETE FROM grail_progress WHERE character_id = ? AND item_id = ?',
    );
    stmt.run(characterId, itemId);
  }

  // Settings methods
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
    };

    return typedSettings;
  }

  getSetting(key: keyof Settings): string | undefined {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value;
  }

  setSetting(key: keyof Settings, value: string): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    stmt.run(key, value);
  }

  // Statistics methods
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
  seedItemsFromGrailData(): void {
    console.log('Starting Holy Grail data seeding...');

    // Clear existing items
    this.db.prepare('DELETE FROM items').run();

    const items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[] = [];

    // Get regular grail data (includes normal versions of all items)
    const regularGrailData = getHolyGrailSeedData(false);
    this.traverseGrailData(regularGrailData, items, false);

    // Get ethereal grail data (only for unique items that can be ethereal)
    const etherealGrailData = getHolyGrailSeedData(true);
    this.traverseGrailData(etherealGrailData, items, true);

    // Insert all items
    this.insertItems(items);

    console.log(`Seeded ${items.length} items from Holy Grail data`);
  }

  private getEtherealType(
    itemName: string,
    itemType: 'unique' | 'set' | 'rune' | 'runeword',
    _isEthereal: boolean,
  ): EtherealType {
    // Sets, runes, and runewords cannot be ethereal
    if (itemType === 'set' || itemType === 'rune' || itemType === 'runeword') {
      return 'none';
    }

    // Check for items that can only be ethereal
    const etherealOnlyItems = ['Ethereal Edge'];
    if (etherealOnlyItems.includes(itemName)) {
      return 'only';
    }

    // Unique items can be ethereal (optional)
    if (itemType === 'unique') {
      return 'optional';
    }

    return 'none';
  }

  private traverseGrailData(
    grailData: GrailData,
    items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[],
    isEthereal: boolean,
  ): void {
    // Handle uniques
    if (grailData.uniques) {
      this.traverseUniques(grailData.uniques as unknown as GrailCategory, items, isEthereal);
    }

    // Handle sets, runes, and runewords only for normal (non-ethereal) data
    if (!isEthereal) {
      // Handle sets (only for regular grail data)
      if ('sets' in grailData && grailData.sets) {
        this.traverseSets(grailData.sets as unknown as Record<string, unknown>, items, isEthereal);
      }

      // Handle runes (if present)
      if ('runes' in grailData && grailData.runes) {
        this.traverseRunes(grailData.runes as Record<string, string>, items, isEthereal);
      }

      // Handle runewords (if present)
      if ('runewords' in grailData && grailData.runewords) {
        this.traverseRunewords(grailData.runewords as Record<string, string>, items, isEthereal);
      }
    }
  }

  private traverseUniques(
    uniques: GrailCategory,
    items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[],
    isEthereal: boolean,
  ): void {
    // Traverse armor
    if (uniques.armor) {
      for (const [subCategory, tiers] of Object.entries(uniques.armor)) {
        this.traverseTiers(
          tiers as GrailTiers,
          items,
          'unique',
          'armor',
          subCategory,
          undefined,
          isEthereal,
        );
      }
    }

    // Traverse weapons
    if (uniques.weapons) {
      for (const [subCategory, tiers] of Object.entries(uniques.weapons)) {
        this.traverseTiers(
          tiers as GrailTiers,
          items,
          'unique',
          'weapons',
          subCategory,
          undefined,
          isEthereal,
        );
      }
    }

    // Traverse other items
    if (uniques.other) {
      this.traverseOther(uniques.other as Record<string, unknown>, items, isEthereal);
    }
  }

  private traverseSets(
    sets: Record<string, unknown>,
    items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[],
    isEthereal: boolean,
  ): void {
    for (const [setName, setItems] of Object.entries(sets)) {
      for (const itemName of Object.keys(setItems as Record<string, unknown>)) {
        const id = `${isEthereal ? 'eth_' : ''}set_${setName}_${itemName}`
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_');
        items.push({
          id,
          name: itemName,
          type: 'set',
          category: 'sets',
          sub_category: setName,
          set_name: setName,
          ethereal_type: this.getEtherealType(itemName, 'set', isEthereal),
        });
      }
    }
  }

  private traverseRunes(
    runes: Record<string, string>,
    items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[],
    isEthereal: boolean,
  ): void {
    for (const runeName of Object.keys(runes)) {
      const id = `${isEthereal ? 'eth_' : ''}rune_${runeName}`
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_');
      items.push({
        id,
        name: runeName,
        type: 'rune',
        category: 'runes',
        sub_category: 'runes',
        ethereal_type: this.getEtherealType(runeName, 'rune', isEthereal),
      });
    }
  }

  private traverseRunewords(
    runewords: Record<string, string>,
    items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[],
    isEthereal: boolean,
  ): void {
    for (const runewordName of Object.values(runewords)) {
      const id = `${isEthereal ? 'eth_' : ''}runeword_${runewordName}`
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_');
      items.push({
        id,
        name: runewordName,
        type: 'runeword',
        category: 'runewords',
        sub_category: 'runewords',
        ethereal_type: this.getEtherealType(runewordName, 'runeword', isEthereal),
      });
    }
  }

  private traverseOther(
    other: Record<string, unknown>,
    items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[],
    isEthereal: boolean,
  ): void {
    if (other.jewelry) {
      this.traverseJewelry(other.jewelry as Record<string, GrailItems>, items, isEthereal);
    }

    if (other.charms) {
      this.traverseCharms(other.charms as Record<string, GrailItems>, items, isEthereal);
    }

    if (other['rainbow facet (jewel)']) {
      this.traverseRainbowFacets(
        other['rainbow facet (jewel)'] as Record<string, GrailItems>,
        items,
        isEthereal,
      );
    }

    if (other.classes) {
      this.traverseClassItems(other.classes as Record<string, GrailItems>, items, isEthereal);
    }
  }

  private traverseJewelry(
    jewelry: Record<string, GrailItems>,
    items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[],
    isEthereal: boolean,
  ): void {
    for (const [subCategory, jewelryItems] of Object.entries(jewelry)) {
      for (const itemName of Object.keys(jewelryItems)) {
        const id = `${isEthereal ? 'eth_' : ''}unique_jewelry_${subCategory}_${itemName}`
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_');
        items.push({
          id,
          name: itemName,
          type: 'unique',
          category: 'jewelry',
          sub_category: subCategory,
          ethereal_type: this.getEtherealType(itemName, 'unique', isEthereal),
        });
      }
    }
  }

  private traverseCharms(
    charms: Record<string, GrailItems>,
    items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[],
    isEthereal: boolean,
  ): void {
    for (const [subCategory, charmItems] of Object.entries(charms)) {
      for (const itemName of Object.keys(charmItems)) {
        const id = `${isEthereal ? 'eth_' : ''}unique_charms_${subCategory}_${itemName}`
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_');
        items.push({
          id,
          name: itemName,
          type: 'unique',
          category: 'charms',
          sub_category: subCategory,
          ethereal_type: this.getEtherealType(itemName, 'unique', isEthereal),
        });
      }
    }
  }

  private traverseRainbowFacets(
    facets: Record<string, GrailItems>,
    items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[],
    isEthereal: boolean,
  ): void {
    for (const [subCategory, facetItems] of Object.entries(facets)) {
      for (const itemName of Object.keys(facetItems)) {
        const id = `${isEthereal ? 'eth_' : ''}unique_jewel_${subCategory}_${itemName}`
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_');
        items.push({
          id,
          name: itemName,
          type: 'unique',
          category: 'jewels',
          sub_category: subCategory,
          ethereal_type: this.getEtherealType(itemName, 'unique', isEthereal),
        });
      }
    }
  }

  private traverseClassItems(
    classes: Record<string, GrailItems>,
    items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[],
    isEthereal: boolean,
  ): void {
    for (const [className, classItems] of Object.entries(classes)) {
      for (const itemName of Object.keys(classItems)) {
        const id = `${isEthereal ? 'eth_' : ''}unique_class_${className}_${itemName}`
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_');
        items.push({
          id,
          name: itemName,
          type: 'unique',
          category: 'class_items',
          sub_category: className,
          ethereal_type: this.getEtherealType(itemName, 'unique', isEthereal),
        });
      }
    }
  }

  private traverseTiers(
    tiers: GrailTiers,
    items: Omit<DatabaseItem, 'created_at' | 'updated_at'>[],
    type: 'unique' | 'set',
    category: string,
    subCategory: string,
    setName: string | undefined,
    isEthereal: boolean,
  ): void {
    // Handle normal, exceptional, elite tiers
    for (const [tier, tierItems] of Object.entries(tiers)) {
      if (tier === 'normal' || tier === 'exceptional' || tier === 'elite' || tier === 'all') {
        for (const itemName of Object.keys(tierItems)) {
          const id =
            `${isEthereal ? 'eth_' : ''}${type}_${category}_${subCategory}_${tier}_${itemName}`
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '_');
          items.push({
            id,
            name: itemName,
            type,
            category,
            sub_category: `${subCategory}_${tier}`,
            set_name: setName,
            ethereal_type: this.getEtherealType(itemName, type, isEthereal),
          });
        }
      } else {
        // This might be a direct item entry, treat as "all" tier
        const id = `${isEthereal ? 'eth_' : ''}${type}_${category}_${subCategory}_all_${tier}`
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_');
        items.push({
          id,
          name: tier,
          type,
          category,
          sub_category: `${subCategory}_all`,
          set_name: setName,
          ethereal_type: this.getEtherealType(tier, type, isEthereal),
        });
      }
    }
  }

  // Utility methods
  backup(backupPath: string): void {
    this.db.backup(backupPath);
  }

  restore(backupPath: string): void {
    // Close current database connection
    this.db.close();

    // Copy backup file to current database location
    copyFileSync(backupPath, this.dbPath);

    // Reopen database connection
    this.db = new Database(this.dbPath);
    this.initializeSchema();
  }

  restoreFromBuffer(backupBuffer: Buffer): void {
    // Close current database connection
    this.db.close();

    // Write backup buffer to current database location
    writeFileSync(this.dbPath, backupBuffer);

    // Reopen database connection
    this.db = new Database(this.dbPath);
    this.initializeSchema();
  }

  close(): void {
    this.db.close();
  }

  // Truncate characters and grail_progress tables
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

  // Get database path for external access
  getDatabasePath(): string {
    return this.dbPath;
  }
}

const grailDatabase = new GrailDatabase();

export { GrailDatabase, grailDatabase };
export type { DatabaseCharacter, DatabaseGrailProgress, DatabaseItem, DatabaseSetting };
