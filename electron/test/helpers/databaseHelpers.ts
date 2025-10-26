import type { Database as DatabaseType } from 'better-sqlite3';
import Database from 'better-sqlite3';

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
 * Initializes the database schema in the test database
 * @param db - The database instance
 */
export function initializeDatabaseSchema(db: DatabaseType): void {
  const schema = `
    -- Items table
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

    -- Characters table
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      character_class TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      hardcore BOOLEAN NOT NULL DEFAULT FALSE,
      expansion BOOLEAN NOT NULL DEFAULT TRUE,
      save_file_path TEXT,
      deleted_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Grail progress table
    CREATE TABLE IF NOT EXISTS grail_progress (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      found_date DATETIME,
      manually_added BOOLEAN NOT NULL DEFAULT FALSE,
      auto_detected BOOLEAN NOT NULL DEFAULT TRUE,
      difficulty TEXT,
      notes TEXT,
      is_ethereal BOOLEAN NOT NULL DEFAULT FALSE,
      from_initial_scan BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Save file states table
    CREATE TABLE IF NOT EXISTS save_file_states (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      last_modified DATETIME NOT NULL,
      last_parsed DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sessions table
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      character_id TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      total_run_time INTEGER DEFAULT 0,
      total_session_time INTEGER DEFAULT 0,
      run_count INTEGER DEFAULT 0,
      archived BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    );

    -- Runs table
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      run_number INTEGER NOT NULL,
      run_type TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      duration INTEGER,
      area TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    );

    -- Run items table
    CREATE TABLE IF NOT EXISTS run_items (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      grail_progress_id TEXT NOT NULL,
      found_time DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
      FOREIGN KEY (grail_progress_id) REFERENCES grail_progress(id) ON DELETE CASCADE
    );

    -- Recent run types table
    CREATE TABLE IF NOT EXISTS recent_run_types (
      id TEXT PRIMARY KEY,
      run_type TEXT NOT NULL UNIQUE,
      last_used DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      use_count INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_sessions_character ON sessions(character_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
    CREATE INDEX IF NOT EXISTS idx_sessions_archived ON sessions(archived);
    CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);
    CREATE INDEX IF NOT EXISTS idx_runs_character ON runs(character_id);
    CREATE INDEX IF NOT EXISTS idx_runs_start_time ON runs(start_time);
    CREATE INDEX IF NOT EXISTS idx_runs_session_number ON runs(session_id, run_number);
    CREATE INDEX IF NOT EXISTS idx_runs_run_type ON runs(run_type);
    CREATE INDEX IF NOT EXISTS idx_run_items_run ON run_items(run_id);
    CREATE INDEX IF NOT EXISTS idx_run_items_progress ON run_items(grail_progress_id);
    CREATE INDEX IF NOT EXISTS idx_recent_run_types_last_used ON recent_run_types(last_used);
  `;

  db.exec(schema);
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
