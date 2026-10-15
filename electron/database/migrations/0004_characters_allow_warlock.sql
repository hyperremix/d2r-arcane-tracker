-- Rebuilds characters so that its character_class CHECK constraint allows 'warlock' (Reign of the
-- Warlock). SQLite cannot change a CHECK constraint in place.
-- The PRAGMA statements below are no-ops inside the migration transaction; the migration runner
-- (electron/database/migrator.ts) turns foreign keys off before it migrates, so dropping the old
-- characters table does not cascade to or reject the rows that reference it.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`character_class` text NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`hardcore` integer DEFAULT false NOT NULL,
	`expansion` integer DEFAULT true NOT NULL,
	`save_file_path` text,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "characters_character_class_check" CHECK(character_class IN ('amazon', 'assassin', 'barbarian', 'druid', 'necromancer', 'paladin', 'sorceress', 'warlock', 'shared_stash'))
);
--> statement-breakpoint
INSERT INTO `__new_characters`("id", "name", "character_class", "level", "hardcore", "expansion", "save_file_path", "deleted_at", "created_at", "updated_at") SELECT "id", "name", "character_class", "level", "hardcore", "expansion", "save_file_path", "deleted_at", "created_at", "updated_at" FROM `characters`;--> statement-breakpoint
DROP TABLE `characters`;--> statement-breakpoint
ALTER TABLE `__new_characters` RENAME TO `characters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_characters_class` ON `characters` (`character_class`);--> statement-breakpoint
CREATE INDEX `idx_characters_deleted_at` ON `characters` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_characters_updated_at` ON `characters` (`updated_at`);--> statement-breakpoint
-- Hand-written: DROP TABLE removed the updated_at trigger of the old table.
CREATE TRIGGER update_characters_timestamp
  AFTER UPDATE ON characters
  BEGIN
    UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
