CREATE TABLE `guest_access_settings` (
	`singleton_id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	CONSTRAINT "guest_access_settings_singleton_check" CHECK("guest_access_settings"."singleton_id" = 1),
	CONSTRAINT "guest_access_settings_enabled_check" CHECK("guest_access_settings"."enabled" IN (0, 1))
);--> statement-breakpoint
INSERT INTO `guest_access_settings` (`singleton_id`, `enabled`)
VALUES (1, 0);--> statement-breakpoint
CREATE TABLE `guest_publications` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`published_at` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `filesystem_entries`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE TABLE `__backup_0013_memo_widgets` AS
SELECT `widget_id`, `markdown`, `updated_at`
FROM `memo_widgets`;--> statement-breakpoint
CREATE TABLE `__backup_0013_checklist_items` AS
SELECT `id`, `widget_id`, `label`, `sort_order`, `created_at`, `updated_at`, `archived_at`
FROM `checklist_items`;--> statement-breakpoint
CREATE TABLE `__backup_0013_checklist_daily_states` AS
SELECT `item_id`, `business_date`, `checked`, `updated_at`
FROM `checklist_daily_states`;--> statement-breakpoint
CREATE TABLE `__backup_0013_checklist_events` AS
SELECT `id`, `widget_id`, `item_id`, `item_label`, `previous_item_label`, `action`, `business_date`, `occurred_at`
FROM `checklist_events`;--> statement-breakpoint
CREATE TABLE `__backup_0013_filesystem_widget_entries` AS
SELECT `id`, `parent_id`, `kind`, `name`, `name_key`, `file_id`, `widget_id`,
       `restore_parent_id`, `restore_path`, `trashed_at`, `created_at`, `updated_at`
FROM `filesystem_entries`
WHERE `widget_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__backup_0013_desktop_widget_order` AS
SELECT `entry_id`, `sort_order`
FROM `desktop_entry_order`
WHERE `entry_id` IN (
  SELECT `id` FROM `filesystem_entries` WHERE `widget_id` IS NOT NULL
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
	CONSTRAINT "dashboard_widgets_type_check" CHECK("__new_dashboard_widgets"."type" IN ('memo', 'daily-checklist', 'storage-status', 'image-upload-profiles', 'admin')),
	CONSTRAINT "dashboard_widgets_position_x_check" CHECK("__new_dashboard_widgets"."position_x" BETWEEN 0 AND 8192),
	CONSTRAINT "dashboard_widgets_position_y_check" CHECK("__new_dashboard_widgets"."position_y" BETWEEN 0 AND 8192),
	CONSTRAINT "dashboard_widgets_width_check" CHECK("__new_dashboard_widgets"."width" > 0 AND "__new_dashboard_widgets"."width" <= 4096),
	CONSTRAINT "dashboard_widgets_height_check" CHECK("__new_dashboard_widgets"."height" > 0 AND "__new_dashboard_widgets"."height" <= 2160),
	CONSTRAINT "dashboard_widgets_window_state_check" CHECK("__new_dashboard_widgets"."window_state" IN ('normal', 'minimized', 'maximized')),
	CONSTRAINT "dashboard_widgets_restore_state_check" CHECK("__new_dashboard_widgets"."restore_state" IN ('normal', 'maximized')),
	CONSTRAINT "dashboard_widgets_stack_order_check" CHECK("__new_dashboard_widgets"."stack_order" >= 0),
	CONSTRAINT "dashboard_widgets_is_open_check" CHECK("__new_dashboard_widgets"."is_open" IN (0, 1))
);--> statement-breakpoint
INSERT INTO `__new_dashboard_widgets`(
  `id`, `type`, `position_x`, `position_y`, `width`, `height`,
  `window_state`, `restore_state`, `stack_order`, `is_open`
)
SELECT `id`, `type`, `position_x`, `position_y`, `width`, `height`,
       `window_state`, `restore_state`, `stack_order`, `is_open`
FROM `dashboard_widgets`;--> statement-breakpoint
DELETE FROM `desktop_entry_order`
WHERE `entry_id` IN (
  SELECT `id` FROM `filesystem_entries` WHERE `widget_id` IS NOT NULL
);--> statement-breakpoint
DELETE FROM `filesystem_entries` WHERE `widget_id` IS NOT NULL;--> statement-breakpoint
DELETE FROM `checklist_daily_states`;--> statement-breakpoint
DELETE FROM `checklist_events`;--> statement-breakpoint
DELETE FROM `checklist_items`;--> statement-breakpoint
DELETE FROM `memo_widgets`;--> statement-breakpoint
-- migration-safety: allow-table-drop dashboard_widgets
DROP TABLE `dashboard_widgets`;--> statement-breakpoint
ALTER TABLE `__new_dashboard_widgets` RENAME TO `dashboard_widgets`;--> statement-breakpoint
CREATE INDEX `idx_dashboard_widgets_stack_order` ON `dashboard_widgets` (`stack_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_dashboard_widgets_storage_status` ON `dashboard_widgets` (`type`)
WHERE `dashboard_widgets`.`type` = 'storage-status';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_dashboard_widgets_image_upload_profiles` ON `dashboard_widgets` (`type`)
WHERE `dashboard_widgets`.`type` = 'image-upload-profiles';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_dashboard_widgets_admin` ON `dashboard_widgets` (`type`)
WHERE `dashboard_widgets`.`type` = 'admin';--> statement-breakpoint
INSERT INTO `memo_widgets` (`widget_id`, `markdown`, `updated_at`)
SELECT `widget_id`, `markdown`, `updated_at`
FROM `__backup_0013_memo_widgets`;--> statement-breakpoint
INSERT INTO `checklist_items` (
  `id`, `widget_id`, `label`, `sort_order`, `created_at`, `updated_at`, `archived_at`
)
SELECT `id`, `widget_id`, `label`, `sort_order`, `created_at`, `updated_at`, `archived_at`
FROM `__backup_0013_checklist_items`;--> statement-breakpoint
INSERT INTO `checklist_daily_states` (`item_id`, `business_date`, `checked`, `updated_at`)
SELECT `item_id`, `business_date`, `checked`, `updated_at`
FROM `__backup_0013_checklist_daily_states`;--> statement-breakpoint
INSERT INTO `checklist_events` (
  `id`, `widget_id`, `item_id`, `item_label`, `previous_item_label`, `action`, `business_date`, `occurred_at`
)
SELECT `id`, `widget_id`, `item_id`, `item_label`, `previous_item_label`, `action`, `business_date`, `occurred_at`
FROM `__backup_0013_checklist_events`;--> statement-breakpoint
INSERT INTO `filesystem_entries` (
  `id`, `parent_id`, `kind`, `name`, `name_key`, `file_id`, `widget_id`,
  `restore_parent_id`, `restore_path`, `trashed_at`, `created_at`, `updated_at`
)
SELECT `id`, `parent_id`, `kind`, `name`, `name_key`, `file_id`, `widget_id`,
       `restore_parent_id`, `restore_path`, `trashed_at`, `created_at`, `updated_at`
FROM `__backup_0013_filesystem_widget_entries`;--> statement-breakpoint
INSERT INTO `desktop_entry_order` (`entry_id`, `sort_order`)
SELECT `entry_id`, `sort_order`
FROM `__backup_0013_desktop_widget_order`;--> statement-breakpoint
-- migration-safety: allow-table-drop __backup_0013_memo_widgets
DROP TABLE `__backup_0013_memo_widgets`;--> statement-breakpoint
-- migration-safety: allow-table-drop __backup_0013_checklist_items
DROP TABLE `__backup_0013_checklist_items`;--> statement-breakpoint
-- migration-safety: allow-table-drop __backup_0013_checklist_daily_states
DROP TABLE `__backup_0013_checklist_daily_states`;--> statement-breakpoint
-- migration-safety: allow-table-drop __backup_0013_checklist_events
DROP TABLE `__backup_0013_checklist_events`;--> statement-breakpoint
-- migration-safety: allow-table-drop __backup_0013_filesystem_widget_entries
DROP TABLE `__backup_0013_filesystem_widget_entries`;--> statement-breakpoint
-- migration-safety: allow-table-drop __backup_0013_desktop_widget_order
DROP TABLE `__backup_0013_desktop_widget_order`;
