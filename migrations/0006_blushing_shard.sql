PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_filesystem_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`file_id` text,
	`widget_id` text,
	`restore_parent_id` text,
	`restore_path` text,
	`trashed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `filesystem_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`widget_id`) REFERENCES `dashboard_widgets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restore_parent_id`) REFERENCES `filesystem_entries`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "filesystem_entries_kind_check" CHECK("__new_filesystem_entries"."kind" IN ('directory', 'file', 'widget')),
	CONSTRAINT "filesystem_entries_file_check" CHECK(("__new_filesystem_entries"."kind" = 'directory' AND "__new_filesystem_entries"."file_id" IS NULL AND "__new_filesystem_entries"."widget_id" IS NULL) OR ("__new_filesystem_entries"."kind" = 'file' AND "__new_filesystem_entries"."file_id" IS NOT NULL AND "__new_filesystem_entries"."widget_id" IS NULL) OR ("__new_filesystem_entries"."kind" = 'widget' AND "__new_filesystem_entries"."file_id" IS NULL AND "__new_filesystem_entries"."widget_id" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_filesystem_entries`("id", "parent_id", "kind", "name", "name_key", "file_id", "widget_id", "restore_parent_id", "restore_path", "trashed_at", "created_at", "updated_at") SELECT "id", "parent_id", "kind", "name", "name_key", "file_id", NULL, "restore_parent_id", "restore_path", "trashed_at", "created_at", "updated_at" FROM `filesystem_entries`;--> statement-breakpoint
DROP TABLE `filesystem_entries`;--> statement-breakpoint
ALTER TABLE `__new_filesystem_entries` RENAME TO `filesystem_entries`;--> statement-breakpoint
CREATE UNIQUE INDEX `filesystem_entries_file_id_unique` ON `filesystem_entries` (`file_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `filesystem_entries_widget_id_unique` ON `filesystem_entries` (`widget_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_filesystem_entries_active_parent_name` ON `filesystem_entries` (`parent_id`,`name_key`) WHERE "filesystem_entries"."trashed_at" IS NULL;--> statement-breakpoint
CREATE INDEX `idx_filesystem_entries_parent_kind_name` ON `filesystem_entries` (`parent_id`,`kind`,`name_key`);--> statement-breakpoint
CREATE INDEX `idx_filesystem_entries_trash` ON `filesystem_entries` (`parent_id`,`trashed_at`);--> statement-breakpoint
INSERT INTO `filesystem_entries` (
	`id`, `parent_id`, `kind`, `name`, `name_key`, `file_id`, `widget_id`,
	`restore_parent_id`, `restore_path`, `trashed_at`, `created_at`, `updated_at`
) VALUES (
	'system-desktop-root', NULL, 'directory', '바탕 화면', '바탕 화면',
	NULL, NULL, NULL, NULL, NULL, 0, 0
);--> statement-breakpoint
CREATE TABLE `__new_dashboard_widgets` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'memo' NOT NULL,
	`position_x` integer NOT NULL,
	`position_y` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`window_state` text DEFAULT 'normal' NOT NULL,
	`restore_state` text DEFAULT 'normal' NOT NULL,
	`stack_order` integer NOT NULL,
	`is_open` integer DEFAULT true NOT NULL,
	CONSTRAINT "dashboard_widgets_type_check" CHECK("__new_dashboard_widgets"."type" IN ('memo', 'daily-checklist')),
	CONSTRAINT "dashboard_widgets_position_x_check" CHECK("__new_dashboard_widgets"."position_x" BETWEEN 0 AND 8192),
	CONSTRAINT "dashboard_widgets_position_y_check" CHECK("__new_dashboard_widgets"."position_y" BETWEEN 0 AND 8192),
	CONSTRAINT "dashboard_widgets_width_check" CHECK("__new_dashboard_widgets"."width" > 0 AND "__new_dashboard_widgets"."width" <= 4096),
	CONSTRAINT "dashboard_widgets_height_check" CHECK("__new_dashboard_widgets"."height" > 0 AND "__new_dashboard_widgets"."height" <= 2160),
	CONSTRAINT "dashboard_widgets_window_state_check" CHECK("__new_dashboard_widgets"."window_state" IN ('normal', 'minimized', 'maximized')),
	CONSTRAINT "dashboard_widgets_restore_state_check" CHECK("__new_dashboard_widgets"."restore_state" IN ('normal', 'maximized')),
	CONSTRAINT "dashboard_widgets_stack_order_check" CHECK("__new_dashboard_widgets"."stack_order" >= 0),
	CONSTRAINT "dashboard_widgets_is_open_check" CHECK("__new_dashboard_widgets"."is_open" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_dashboard_widgets`("id", "type", "position_x", "position_y", "width", "height", "window_state", "restore_state", "stack_order", "is_open") SELECT "id", "type", "position_x", "position_y", "width", "height", "window_state", "restore_state", "stack_order", 1 FROM `dashboard_widgets`;--> statement-breakpoint
DROP TABLE `dashboard_widgets`;--> statement-breakpoint
ALTER TABLE `__new_dashboard_widgets` RENAME TO `dashboard_widgets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_dashboard_widgets_stack_order` ON `dashboard_widgets` (`stack_order`);
--> statement-breakpoint
CREATE TABLE `desktop_entry_order` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `filesystem_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "desktop_entry_order_value_check" CHECK("desktop_entry_order"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `desktop_entry_order_sort_order_unique` ON `desktop_entry_order` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_desktop_entry_order_sort` ON `desktop_entry_order` (`sort_order`);
