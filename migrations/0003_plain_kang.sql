PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_checklist_events` (
	`id` text PRIMARY KEY NOT NULL,
	`widget_id` text NOT NULL,
	`item_id` text NOT NULL,
	`item_label` text NOT NULL,
	`previous_item_label` text,
	`action` text NOT NULL,
	`business_date` text NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`widget_id`) REFERENCES `dashboard_widgets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `checklist_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "checklist_events_action_check" CHECK("__new_checklist_events"."action" IN ('added', 'renamed', 'deleted', 'checked', 'unchecked')),
	CONSTRAINT "checklist_events_previous_label_check" CHECK("__new_checklist_events"."previous_item_label" IS NULL OR length("__new_checklist_events"."previous_item_label") BETWEEN 1 AND 200)
);
--> statement-breakpoint
INSERT INTO `__new_checklist_events`("id", "widget_id", "item_id", "item_label", "previous_item_label", "action", "business_date", "occurred_at") SELECT "id", "widget_id", "item_id", "item_label", NULL, "action", "business_date", "occurred_at" FROM `checklist_events`;--> statement-breakpoint
DROP TABLE `checklist_events`;--> statement-breakpoint
ALTER TABLE `__new_checklist_events` RENAME TO `checklist_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_checklist_events_widget_time` ON `checklist_events` (`widget_id`,`occurred_at`,`id`);
