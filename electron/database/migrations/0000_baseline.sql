CREATE TABLE `characters` (
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
	CONSTRAINT "characters_character_class_check" CHECK(character_class IN ('amazon', 'assassin', 'barbarian', 'druid', 'necromancer', 'paladin', 'sorceress', 'shared_stash'))
);
--> statement-breakpoint
CREATE INDEX `idx_characters_class` ON `characters` (`character_class`);--> statement-breakpoint
CREATE INDEX `idx_characters_deleted_at` ON `characters` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_characters_updated_at` ON `characters` (`updated_at`);--> statement-breakpoint
CREATE TABLE `grail_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`item_id` text NOT NULL,
	`found_date` text,
	`manually_added` integer DEFAULT false NOT NULL,
	`auto_detected` integer DEFAULT true NOT NULL,
	`difficulty` text,
	`notes` text,
	`is_ethereal` integer DEFAULT false NOT NULL,
	`from_initial_scan` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "grail_progress_difficulty_check" CHECK(difficulty IN ('normal', 'nightmare', 'hell'))
);
--> statement-breakpoint
CREATE INDEX `idx_grail_progress_character` ON `grail_progress` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_grail_progress_item` ON `grail_progress` (`item_id`);--> statement-breakpoint
CREATE INDEX `idx_grail_progress_found_date` ON `grail_progress` (`found_date`);--> statement-breakpoint
CREATE INDEX `idx_grail_progress_character_item` ON `grail_progress` (`character_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `idx_grail_progress_updated_at` ON `grail_progress` (`updated_at`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`link` text,
	`code` text,
	`item_base` text,
	`image_filename` text,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`sub_category` text NOT NULL,
	`treasure_class` text NOT NULL,
	`set_name` text,
	`runes` text,
	`ethereal_type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "items_type_check" CHECK(type IN ('unique', 'set', 'rune', 'runeword')),
	CONSTRAINT "items_ethereal_type_check" CHECK(ethereal_type IN ('none', 'optional', 'only'))
);
--> statement-breakpoint
CREATE INDEX `idx_items_category` ON `items` (`category`);--> statement-breakpoint
CREATE INDEX `idx_items_type` ON `items` (`type`);--> statement-breakpoint
CREATE TABLE `run_items` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`grail_progress_id` text,
	`name` text,
	`found_time` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grail_progress_id`) REFERENCES `grail_progress`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_run_items_run` ON `run_items` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_run_items_progress` ON `run_items` (`grail_progress_id`);--> statement-breakpoint
CREATE TABLE `runs` (
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
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_runs_session` ON `runs` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_character` ON `runs` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_start_time` ON `runs` (`start_time`);--> statement-breakpoint
CREATE INDEX `idx_runs_session_number` ON `runs` (`session_id`,`run_number`);--> statement-breakpoint
CREATE TABLE `save_file_states` (
	`id` text PRIMARY KEY NOT NULL,
	`file_path` text NOT NULL,
	`last_modified` text NOT NULL,
	`last_parsed` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `save_file_states_file_path_unique` ON `save_file_states` (`file_path`);--> statement-breakpoint
CREATE INDEX `idx_save_file_states_path` ON `save_file_states` (`file_path`);--> statement-breakpoint
CREATE INDEX `idx_save_file_states_modified` ON `save_file_states` (`last_modified`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`total_run_time` integer DEFAULT 0,
	`total_session_time` integer DEFAULT 0,
	`run_count` integer DEFAULT 0,
	`archived` integer DEFAULT false,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_start_time` ON `sessions` (`start_time`);--> statement-breakpoint
CREATE INDEX `idx_sessions_archived` ON `sessions` (`archived`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `vault_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_vault_categories_name` ON `vault_categories` (`name`);--> statement-breakpoint
CREATE TABLE `vault_item_categories` (
	`vault_item_id` text NOT NULL,
	`vault_category_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`vault_item_id`, `vault_category_id`),
	FOREIGN KEY (`vault_item_id`) REFERENCES `vault_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vault_category_id`) REFERENCES `vault_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_vault_item_categories_item` ON `vault_item_categories` (`vault_item_id`);--> statement-breakpoint
CREATE INDEX `idx_vault_item_categories_category` ON `vault_item_categories` (`vault_category_id`);--> statement-breakpoint
CREATE TABLE `vault_items` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`item_name` text NOT NULL,
	`item_code` text,
	`quality` text NOT NULL,
	`ethereal` integer DEFAULT false NOT NULL,
	`socket_count` integer,
	`stack_count` integer DEFAULT 1 NOT NULL,
	`raw_item_json` text NOT NULL,
	`source_character_id` text,
	`source_character_name` text,
	`source_file_type` text NOT NULL,
	`source_file_path` text,
	`location_context` text DEFAULT 'unknown' NOT NULL,
	`stash_tab` integer,
	`grid_x` integer,
	`grid_y` integer,
	`grid_width` integer,
	`grid_height` integer,
	`equipped_slot_id` integer,
	`icon_file_name` text,
	`is_socketed_item` integer DEFAULT false NOT NULL,
	`grail_item_id` text,
	`is_present_in_latest_scan` integer DEFAULT true NOT NULL,
	`last_seen_at` text,
	`vaulted_at` text,
	`unvaulted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`source_character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`grail_item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "vault_items_source_file_type_check" CHECK(source_file_type IN ('d2s', 'sss', 'd2x', 'd2i')),
	CONSTRAINT "vault_items_location_context_check" CHECK(location_context IN ('equipped', 'inventory', 'stash', 'mercenary', 'corpse', 'unknown'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_vault_items_fingerprint` ON `vault_items` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_vault_items_item_name` ON `vault_items` (`item_name`);--> statement-breakpoint
CREATE INDEX `idx_vault_items_item_code` ON `vault_items` (`item_code`);--> statement-breakpoint
CREATE INDEX `idx_vault_items_quality` ON `vault_items` (`quality`);--> statement-breakpoint
CREATE INDEX `idx_vault_items_source_character_id` ON `vault_items` (`source_character_id`);--> statement-breakpoint
CREATE INDEX `idx_vault_items_source_file_type` ON `vault_items` (`source_file_type`);--> statement-breakpoint
CREATE INDEX `idx_vault_items_location_context` ON `vault_items` (`location_context`);--> statement-breakpoint
CREATE INDEX `idx_vault_items_socketed` ON `vault_items` (`is_socketed_item`);--> statement-breakpoint
CREATE INDEX `idx_vault_items_grail_item_id` ON `vault_items` (`grail_item_id`);--> statement-breakpoint
CREATE INDEX `idx_vault_items_present_scan` ON `vault_items` (`is_present_in_latest_scan`);--> statement-breakpoint
CREATE INDEX `idx_vault_items_last_seen_at` ON `vault_items` (`last_seen_at`);--> statement-breakpoint
-- Hand-written: drizzle-kit does not model triggers. Keep updated_at current on every UPDATE.
CREATE TRIGGER update_items_timestamp
  AFTER UPDATE ON items
  BEGIN
    UPDATE items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
CREATE TRIGGER update_characters_timestamp
  AFTER UPDATE ON characters
  BEGIN
    UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
CREATE TRIGGER update_grail_progress_timestamp
  AFTER UPDATE ON grail_progress
  BEGIN
    UPDATE grail_progress SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
CREATE TRIGGER update_settings_timestamp
  AFTER UPDATE ON settings
  BEGIN
    UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
  END;--> statement-breakpoint
CREATE TRIGGER update_save_file_states_timestamp
  AFTER UPDATE ON save_file_states
  BEGIN
    UPDATE save_file_states SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
CREATE TRIGGER update_sessions_timestamp
  AFTER UPDATE ON sessions
  BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
CREATE TRIGGER update_runs_timestamp
  AFTER UPDATE ON runs
  BEGIN
    UPDATE runs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
CREATE TRIGGER update_vault_categories_timestamp
  AFTER UPDATE ON vault_categories
  BEGIN
    UPDATE vault_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;--> statement-breakpoint
CREATE TRIGGER update_vault_items_timestamp
  AFTER UPDATE ON vault_items
  BEGIN
    UPDATE vault_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
