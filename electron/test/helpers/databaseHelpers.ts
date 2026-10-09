import type { Database as DatabaseType } from 'better-sqlite3';
import Database from 'better-sqlite3';
import { createDrizzleDb } from '../../database/drizzle';
import { runMigrations } from '../../database/migrator';

/**
 * Creates an in-memory SQLite database for testing
 * @returns A database instance
 */
export function createInMemoryDatabase(): DatabaseType {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Creates the production schema in the test database by applying the app's migrations.
 * No default settings or item data are inserted.
 * @param db - The database instance
 */
export function initializeDatabaseSchema(db: DatabaseType): void {
  runMigrations({ rawDb: db, db: createDrizzleDb(db), dbPath: ':memory:' });
}

/**
 * Seeds the test database with minimal data
 * @param db - The database instance
 */
export function seedTestData(db: DatabaseType): void {
  // Insert some test characters
  const characterStmt = db.prepare(`
    INSERT INTO characters (id, name, character_class, level, hardcore, expansion)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  characterStmt.run('char-1', 'TestCharacter', 'sorceress', 90, 0, 1);
  characterStmt.run('char-2', 'TestBarbarian', 'barbarian', 85, 0, 1);

  // Insert some test items
  const itemStmt = db.prepare(`
    INSERT INTO items (id, name, link, type, category, sub_category, treasure_class, ethereal_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  itemStmt.run(
    'shako',
    'Harlequin Crest',
    'https://example.com/shako',
    'unique',
    'armor',
    'helms',
    'normal',
    'none',
  );
  itemStmt.run(
    'windforce',
    'Windforce',
    'https://example.com/windforce',
    'unique',
    'weapons',
    'bows',
    'normal',
    'none',
  );

  // Insert default settings
  const settingsStmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
  `);

  settingsStmt.run('saveDir', '/test/save');
  settingsStmt.run('runTrackerAutoStart', 'true');
  settingsStmt.run('runTrackerEndThreshold', '10');
}

/**
 * Cleans up the database by closing the connection
 * @param db - The database instance
 */
export function cleanupDatabase(db: DatabaseType): void {
  db.close();
}

/**
 * Creates a mock GrailDatabase instance with an in-memory database
 * Note: This is a lightweight mock that doesn't use the full GrailDatabase class
 * @returns Object with database instance and helper methods
 */
export function createMockGrailDatabase(): {
  db: DatabaseType;
  close: () => void;
} {
  const db = createInMemoryDatabase();
  initializeDatabaseSchema(db);
  seedTestData(db);

  return {
    db,
    close: () => cleanupDatabase(db),
  };
}
