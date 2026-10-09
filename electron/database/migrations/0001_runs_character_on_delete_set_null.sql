-- Rebuilds runs so that deleting a character clears runs.character_id (ON DELETE SET NULL)
-- instead of failing. SQLite cannot change a foreign key in place.
-- The PRAGMA statements below are no-ops inside the migration transaction; the migration runner
-- (electron/database/migrator.ts) turns foreign keys off before it migrates, so dropping the old
-- runs table does not cascade-delete run_items.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`character_id` text,
	`run_number` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`duration` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_runs`("id", "session_id", "character_id", "run_number", "start_time", "end_time", "duration", "created_at", "updated_at") SELECT "id", "session_id", "character_id", "run_number", "start_time", "end_time", "duration", "created_at", "updated_at" FROM `runs`;--> statement-breakpoint
DROP TABLE `runs`;--> statement-breakpoint
ALTER TABLE `__new_runs` RENAME TO `runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_runs_session` ON `runs` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_character` ON `runs` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_start_time` ON `runs` (`start_time`);--> statement-breakpoint
CREATE INDEX `idx_runs_session_number` ON `runs` (`session_id`,`run_number`);--> statement-breakpoint
-- Hand-written: DROP TABLE removed the updated_at trigger of the old table.
CREATE TRIGGER update_runs_timestamp
  AFTER UPDATE ON runs
  BEGIN
    UPDATE runs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
