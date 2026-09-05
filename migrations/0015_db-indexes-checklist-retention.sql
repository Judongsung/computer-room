CREATE TABLE `checklist_settings` (
	`singleton_id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`retention_days` integer,
	CONSTRAINT "checklist_settings_singleton_check" CHECK("checklist_settings"."singleton_id" = 1),
	CONSTRAINT "checklist_settings_retention_check" CHECK("checklist_settings"."retention_days" IS NULL OR ("checklist_settings"."retention_days" BETWEEN 1 AND 3650 AND typeof("checklist_settings"."retention_days") = 'integer'))
);
--> statement-breakpoint
DROP INDEX `idx_desktop_entry_order_sort`;--> statement-breakpoint
DROP INDEX `idx_filesystem_entries_parent_kind_name`;--> statement-breakpoint
CREATE INDEX `idx_filesystem_entries_active_name` ON `filesystem_entries` (`parent_id`,CASE "kind" WHEN 'directory' THEN 0 ELSE 1 END,`name_key`,`id`) WHERE "filesystem_entries"."trashed_at" IS NULL;--> statement-breakpoint
CREATE INDEX `idx_filesystem_entries_restore_parent` ON `filesystem_entries` (`restore_parent_id`) WHERE "filesystem_entries"."restore_parent_id" IS NOT NULL;--> statement-breakpoint
DROP INDEX `idx_integration_image_profiles_enabled`;--> statement-breakpoint
CREATE INDEX `idx_checklist_events_item` ON `checklist_events` (`item_id`);--> statement-breakpoint
CREATE INDEX `idx_checklist_events_time` ON `checklist_events` (`occurred_at`);
--> statement-breakpoint
INSERT INTO checklist_settings(singleton_id, retention_days) VALUES (1, NULL);
