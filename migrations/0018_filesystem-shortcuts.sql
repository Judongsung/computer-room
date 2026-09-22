-- Preserve all filesystem rows and referencing tables before replacing the kind constraint.
-- migration-safety: allow-table-drop filesystem_entries
-- migration-safety: allow-table-drop __backup_0018_filesystem_entries
-- migration-safety: allow-table-drop __backup_0018_desktop_entry_order
-- migration-safety: allow-table-drop __backup_0018_filesystem_directory_preferences
-- migration-safety: allow-table-drop __backup_0018_mobile_preferences
-- migration-safety: allow-table-drop __backup_0018_guest_publications
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE __backup_0018_filesystem_entries AS SELECT * FROM filesystem_entries;--> statement-breakpoint
CREATE TABLE __backup_0018_desktop_entry_order AS SELECT * FROM desktop_entry_order;--> statement-breakpoint
CREATE TABLE __backup_0018_filesystem_directory_preferences AS SELECT * FROM filesystem_directory_preferences;--> statement-breakpoint
CREATE TABLE __backup_0018_mobile_preferences AS SELECT * FROM mobile_preferences;--> statement-breakpoint
CREATE TABLE __backup_0018_guest_publications AS SELECT * FROM guest_publications;--> statement-breakpoint
CREATE TABLE `__new_filesystem_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`file_id` text,
	`widget_id` text,
	`restore_parent_id` text,
	`target_entry_id` text,
	`restore_path` text,
	`trashed_at` integer,
	`deletion_started_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `filesystem_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`widget_id`) REFERENCES `dashboard_widgets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restore_parent_id`) REFERENCES `filesystem_entries`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "filesystem_entries_kind_check" CHECK("__new_filesystem_entries"."kind" IN ('directory', 'file', 'widget', 'shortcut')),
	CONSTRAINT "filesystem_entries_file_check" CHECK(("__new_filesystem_entries"."kind" != 'shortcut' AND "__new_filesystem_entries"."target_entry_id" IS NULL AND (("__new_filesystem_entries"."kind" = 'directory' AND "__new_filesystem_entries"."file_id" IS NULL AND "__new_filesystem_entries"."widget_id" IS NULL) OR ("__new_filesystem_entries"."kind" = 'file' AND "__new_filesystem_entries"."file_id" IS NOT NULL AND "__new_filesystem_entries"."widget_id" IS NULL) OR ("__new_filesystem_entries"."kind" = 'widget' AND "__new_filesystem_entries"."file_id" IS NULL AND "__new_filesystem_entries"."widget_id" IS NOT NULL))) OR ("__new_filesystem_entries"."kind" = 'shortcut' AND "__new_filesystem_entries"."target_entry_id" IS NOT NULL AND "__new_filesystem_entries"."file_id" IS NULL AND "__new_filesystem_entries"."widget_id" IS NULL))
);
--> statement-breakpoint
DROP TABLE `filesystem_entries`;--> statement-breakpoint
ALTER TABLE `__new_filesystem_entries` RENAME TO `filesystem_entries`;--> statement-breakpoint
INSERT INTO `filesystem_entries`("id", "parent_id", "kind", "name", "name_key", "file_id", "widget_id", "restore_parent_id", "target_entry_id", "restore_path", "trashed_at", "deletion_started_at", "created_at", "updated_at") SELECT "id", "parent_id", "kind", "name", "name_key", "file_id", "widget_id", "restore_parent_id", NULL, "restore_path", "trashed_at", "deletion_started_at", "created_at", "updated_at" FROM __backup_0018_filesystem_entries;--> statement-breakpoint
DELETE FROM desktop_entry_order;--> statement-breakpoint
INSERT INTO desktop_entry_order SELECT * FROM __backup_0018_desktop_entry_order;--> statement-breakpoint
DELETE FROM filesystem_directory_preferences;--> statement-breakpoint
INSERT INTO filesystem_directory_preferences SELECT * FROM __backup_0018_filesystem_directory_preferences;--> statement-breakpoint
DELETE FROM mobile_preferences;--> statement-breakpoint
INSERT INTO mobile_preferences SELECT * FROM __backup_0018_mobile_preferences;--> statement-breakpoint
DELETE FROM guest_publications;--> statement-breakpoint
INSERT INTO guest_publications SELECT * FROM __backup_0018_guest_publications;--> statement-breakpoint
DROP TABLE __backup_0018_filesystem_entries;--> statement-breakpoint
DROP TABLE __backup_0018_desktop_entry_order;--> statement-breakpoint
DROP TABLE __backup_0018_filesystem_directory_preferences;--> statement-breakpoint
DROP TABLE __backup_0018_mobile_preferences;--> statement-breakpoint
DROP TABLE __backup_0018_guest_publications;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `filesystem_entries_file_id_unique` ON `filesystem_entries` (`file_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `filesystem_entries_widget_id_unique` ON `filesystem_entries` (`widget_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_filesystem_entries_active_parent_name` ON `filesystem_entries` (`parent_id`,`name_key`) WHERE "filesystem_entries"."trashed_at" IS NULL;--> statement-breakpoint
CREATE INDEX `idx_filesystem_entries_active_name` ON `filesystem_entries` (`parent_id`,CASE "kind" WHEN 'directory' THEN 0 ELSE 1 END,`name_key`,`id`) WHERE "filesystem_entries"."trashed_at" IS NULL;--> statement-breakpoint
CREATE INDEX `idx_filesystem_entries_restore_parent` ON `filesystem_entries` (`restore_parent_id`) WHERE "filesystem_entries"."restore_parent_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_filesystem_entries_trash` ON `filesystem_entries` (`parent_id`,`trashed_at`);