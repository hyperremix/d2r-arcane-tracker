-- One-time data repairs that older versions ran on every launch.
--
-- 1. Literal 'CURRENT_TIMESTAMP' text in created_at/updated_at.
--    The drizzle schema used `.default('CURRENT_TIMESTAMP')`, which drizzle binds as a string, so
--    rows inserted through drizzle stored that text instead of a timestamp. created_at takes the
--    best known time (start_time for sessions and runs, found_time for run items), then a valid
--    updated_at, then now. updated_at takes the repaired created_at. datetime() normalizes ISO
--    values to the CURRENT_TIMESTAMP format and returns NULL for unparseable text. Each table's
--    updated_at trigger is dropped while it is repaired so it does not reset valid updated_at
--    values to now.
DROP TRIGGER IF EXISTS update_items_timestamp;--> statement-breakpoint
UPDATE items SET created_at = COALESCE(datetime(updated_at), CURRENT_TIMESTAMP) WHERE created_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE items SET updated_at = COALESCE(datetime(created_at), CURRENT_TIMESTAMP) WHERE updated_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
CREATE TRIGGER update_items_timestamp
  AFTER UPDATE ON items
  BEGIN
    UPDATE items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
DROP TRIGGER IF EXISTS update_characters_timestamp;--> statement-breakpoint
UPDATE characters SET created_at = COALESCE(datetime(updated_at), CURRENT_TIMESTAMP) WHERE created_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE characters SET updated_at = COALESCE(datetime(created_at), CURRENT_TIMESTAMP) WHERE updated_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
CREATE TRIGGER update_characters_timestamp
  AFTER UPDATE ON characters
  BEGIN
    UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
DROP TRIGGER IF EXISTS update_grail_progress_timestamp;--> statement-breakpoint
UPDATE grail_progress SET created_at = COALESCE(datetime(updated_at), CURRENT_TIMESTAMP) WHERE created_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE grail_progress SET updated_at = COALESCE(datetime(created_at), CURRENT_TIMESTAMP) WHERE updated_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
CREATE TRIGGER update_grail_progress_timestamp
  AFTER UPDATE ON grail_progress
  BEGIN
    UPDATE grail_progress SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
DROP TRIGGER IF EXISTS update_settings_timestamp;--> statement-breakpoint
UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE updated_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
CREATE TRIGGER update_settings_timestamp
  AFTER UPDATE ON settings
  BEGIN
    UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
  END;--> statement-breakpoint
DROP TRIGGER IF EXISTS update_save_file_states_timestamp;--> statement-breakpoint
UPDATE save_file_states SET created_at = COALESCE(datetime(updated_at), CURRENT_TIMESTAMP) WHERE created_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE save_file_states SET updated_at = COALESCE(datetime(created_at), CURRENT_TIMESTAMP) WHERE updated_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
CREATE TRIGGER update_save_file_states_timestamp
  AFTER UPDATE ON save_file_states
  BEGIN
    UPDATE save_file_states SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
DROP TRIGGER IF EXISTS update_sessions_timestamp;--> statement-breakpoint
UPDATE sessions SET created_at = COALESCE(datetime(start_time), datetime(updated_at), CURRENT_TIMESTAMP) WHERE created_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE sessions SET updated_at = COALESCE(datetime(created_at), CURRENT_TIMESTAMP) WHERE updated_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
CREATE TRIGGER update_sessions_timestamp
  AFTER UPDATE ON sessions
  BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
DROP TRIGGER IF EXISTS update_runs_timestamp;--> statement-breakpoint
UPDATE runs SET created_at = COALESCE(datetime(start_time), datetime(updated_at), CURRENT_TIMESTAMP) WHERE created_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE runs SET updated_at = COALESCE(datetime(created_at), CURRENT_TIMESTAMP) WHERE updated_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
CREATE TRIGGER update_runs_timestamp
  AFTER UPDATE ON runs
  BEGIN
    UPDATE runs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
UPDATE run_items SET created_at = COALESCE(datetime(found_time), CURRENT_TIMESTAMP) WHERE created_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
DROP TRIGGER IF EXISTS update_vault_categories_timestamp;--> statement-breakpoint
UPDATE vault_categories SET created_at = COALESCE(datetime(updated_at), CURRENT_TIMESTAMP) WHERE created_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE vault_categories SET updated_at = COALESCE(datetime(created_at), CURRENT_TIMESTAMP) WHERE updated_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
CREATE TRIGGER update_vault_categories_timestamp
  AFTER UPDATE ON vault_categories
  BEGIN
    UPDATE vault_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
DROP TRIGGER IF EXISTS update_vault_items_timestamp;--> statement-breakpoint
UPDATE vault_items SET created_at = COALESCE(datetime(updated_at), CURRENT_TIMESTAMP) WHERE created_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE vault_items SET updated_at = COALESCE(datetime(created_at), CURRENT_TIMESTAMP) WHERE updated_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
CREATE TRIGGER update_vault_items_timestamp
  AFTER UPDATE ON vault_items
  BEGIN
    UPDATE vault_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
UPDATE vault_item_categories SET created_at = CURRENT_TIMESTAMP WHERE created_at = 'CURRENT_TIMESTAMP';--> statement-breakpoint
-- 2. Run tracker auto mode.
--    runTrackerAutoStart (default 'true') was replaced by runTrackerMemoryReading. Older versions
--    copied it over on every launch, which also turned auto mode back on after the user switched
--    it off. It is now copied once. A missing runTrackerAutoStart counts as its default 'true', so
--    new databases start with auto mode on, as before.
INSERT INTO settings (key, value)
  SELECT 'runTrackerMemoryReading', 'true'
  WHERE COALESCE((SELECT value FROM settings WHERE key = 'runTrackerAutoStart'), 'true') = 'true'
  ON CONFLICT (key) DO UPDATE SET value = 'true' WHERE value IS NOT 'true';
