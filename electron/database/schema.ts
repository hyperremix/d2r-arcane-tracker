import { items as grailItemsData } from '../items';
import { schema } from './drizzle';
import { insertItems } from './items';
import type { DatabaseContext } from './types';

const { settings } = schema;

export function createSchema(ctx: DatabaseContext): void {
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

      -- Vault categories table - stores category metadata for vaulted items
      CREATE TABLE IF NOT EXISTS vault_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Vault items table - stores item snapshots captured from save scans
      CREATE TABLE IF NOT EXISTS vault_items (
        id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL,
        item_name TEXT NOT NULL,
        item_code TEXT,
        quality TEXT NOT NULL,
        ethereal BOOLEAN NOT NULL DEFAULT FALSE,
        socket_count INTEGER,
        raw_item_json TEXT NOT NULL,
        source_character_id TEXT,
        source_character_name TEXT,
        source_file_type TEXT NOT NULL CHECK (source_file_type IN ('d2s', 'sss', 'd2x', 'd2i')),
        location_context TEXT NOT NULL DEFAULT 'unknown' CHECK (
          location_context IN ('equipped', 'inventory', 'stash', 'mercenary', 'corpse', 'unknown')
        ),
        stash_tab INTEGER,
        grail_item_id TEXT,
        is_present_in_latest_scan BOOLEAN NOT NULL DEFAULT TRUE,
        last_seen_at DATETIME,
        vaulted_at DATETIME,
        unvaulted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_character_id) REFERENCES characters(id) ON DELETE SET NULL,
        FOREIGN KEY (grail_item_id) REFERENCES items(id) ON DELETE SET NULL
      );

      -- Vault item categories table - many-to-many mapping for item category tags
      CREATE TABLE IF NOT EXISTS vault_item_categories (
        vault_item_id TEXT NOT NULL,
        vault_category_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (vault_item_id, vault_category_id),
        FOREIGN KEY (vault_item_id) REFERENCES vault_items(id) ON DELETE CASCADE,
        FOREIGN KEY (vault_category_id) REFERENCES vault_categories(id) ON DELETE CASCADE
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

      -- Vault category indexes
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_categories_name ON vault_categories(name);

      -- Vault items indexes
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_items_fingerprint ON vault_items(fingerprint);
      CREATE INDEX IF NOT EXISTS idx_vault_items_item_name ON vault_items(item_name);
      CREATE INDEX IF NOT EXISTS idx_vault_items_item_code ON vault_items(item_code);
      CREATE INDEX IF NOT EXISTS idx_vault_items_quality ON vault_items(quality);
      CREATE INDEX IF NOT EXISTS idx_vault_items_source_character_id ON vault_items(source_character_id);
      CREATE INDEX IF NOT EXISTS idx_vault_items_source_file_type ON vault_items(source_file_type);
      CREATE INDEX IF NOT EXISTS idx_vault_items_location_context ON vault_items(location_context);
      CREATE INDEX IF NOT EXISTS idx_vault_items_grail_item_id ON vault_items(grail_item_id);
      CREATE INDEX IF NOT EXISTS idx_vault_items_present_scan ON vault_items(is_present_in_latest_scan);
      CREATE INDEX IF NOT EXISTS idx_vault_items_last_seen_at ON vault_items(last_seen_at);

      -- Vault item categories indexes
      CREATE INDEX IF NOT EXISTS idx_vault_item_categories_item ON vault_item_categories(vault_item_id);
      CREATE INDEX IF NOT EXISTS idx_vault_item_categories_category ON vault_item_categories(vault_category_id);

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

      CREATE TRIGGER IF NOT EXISTS update_vault_categories_timestamp
        AFTER UPDATE ON vault_categories
        BEGIN
          UPDATE vault_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_vault_items_timestamp
        AFTER UPDATE ON vault_items
        BEGIN
          UPDATE vault_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
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

  ctx.rawDb.exec(schemaSQL);
  console.log('Database schema created successfully');

  // Ensure wizard settings exist for existing databases
  ensureWizardSettings(ctx);

  // Migrate runTrackerAutoStart to runTrackerMemoryReading for existing databases
  migrateRunTrackerAutoStart(ctx);

  // Always upsert items to ensure latest changes are available
  upsertItemsFromGrailData(ctx);
}

function migrateRunTrackerAutoStart(ctx: DatabaseContext): void {
  const rows = ctx.db.select().from(settings).all();
  const settingsMap: Record<string, string> = {};
  for (const row of rows) {
    settingsMap[row.key] = row.value ?? '';
  }

  if (
    settingsMap.runTrackerAutoStart === 'true' &&
    settingsMap.runTrackerMemoryReading !== 'true'
  ) {
    console.log('[Database] Migrating runTrackerAutoStart to runTrackerMemoryReading (auto mode)');
    ctx.db
      .insert(settings)
      .values({ key: 'runTrackerMemoryReading', value: 'true' })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: 'true' },
      })
      .run();
  }
}

function ensureWizardSettings(ctx: DatabaseContext): void {
  const wizardSettings = [
    { key: 'wizardCompleted', value: 'false' },
    { key: 'wizardSkipped', value: 'false' },
  ];

  for (const setting of wizardSettings) {
    ctx.db
      .insert(settings)
      .values({ key: setting.key, value: setting.value })
      .onConflictDoNothing()
      .run();
  }
}

export function upsertItemsFromGrailData(ctx: DatabaseContext): void {
  console.log('Upserting Holy Grail item data...');
  insertItems(ctx, grailItemsData);
  console.log(`Upserted ${grailItemsData.length} items from Holy Grail data`);
}
