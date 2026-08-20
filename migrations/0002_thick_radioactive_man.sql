PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_dashboard_widgets` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'memo' NOT NULL,
	`grid_column` integer NOT NULL,
	`grid_row` integer NOT NULL,
	`grid_columns` integer NOT NULL,
	`grid_rows` integer NOT NULL,
	CONSTRAINT "dashboard_widgets_type_check" CHECK("__new_dashboard_widgets"."type" IN ('memo', 'daily-checklist')),
	CONSTRAINT "dashboard_widgets_column_check" CHECK("__new_dashboard_widgets"."grid_column" >= 0 AND "__new_dashboard_widgets"."grid_column" < 12),
	CONSTRAINT "dashboard_widgets_row_check" CHECK("__new_dashboard_widgets"."grid_row" >= 0 AND "__new_dashboard_widgets"."grid_row" <= 999),
	CONSTRAINT "dashboard_widgets_width_check" CHECK("__new_dashboard_widgets"."grid_columns" >= 2 AND "__new_dashboard_widgets"."grid_columns" <= 12),
	CONSTRAINT "dashboard_widgets_height_check" CHECK("__new_dashboard_widgets"."grid_rows" >= 2 AND "__new_dashboard_widgets"."grid_rows" <= 12),
	CONSTRAINT "dashboard_widgets_horizontal_bounds_check" CHECK("__new_dashboard_widgets"."grid_column" + "__new_dashboard_widgets"."grid_columns" <= 12)
);--> statement-breakpoint
INSERT INTO `__new_dashboard_widgets`(
	"id", "type", "grid_column", "grid_row", "grid_columns", "grid_rows"
)
SELECT
	"id",
	CASE WHEN "type" = 'blank' THEN 'memo' ELSE "type" END,
	"grid_column", "grid_row", "grid_columns", "grid_rows"
FROM `dashboard_widgets`;--> statement-breakpoint
DROP TABLE `dashboard_widgets`;--> statement-breakpoint
ALTER TABLE `__new_dashboard_widgets` RENAME TO `dashboard_widgets`;--> statement-breakpoint
CREATE INDEX `idx_dashboard_widgets_position` ON `dashboard_widgets` (`grid_row`,`grid_column`);--> statement-breakpoint
CREATE TABLE `memo_widgets` (
	`widget_id` text PRIMARY KEY NOT NULL,
	`markdown` text DEFAULT '' NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`widget_id`) REFERENCES `dashboard_widgets`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE TABLE `checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`widget_id` text NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`widget_id`) REFERENCES `dashboard_widgets`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "checklist_items_label_check" CHECK(length("checklist_items"."label") BETWEEN 1 AND 200),
	CONSTRAINT "checklist_items_sort_order_check" CHECK("checklist_items"."sort_order" >= 0)
);--> statement-breakpoint
CREATE INDEX `idx_checklist_items_widget_order` ON `checklist_items` (`widget_id`,`archived_at`,`sort_order`);--> statement-breakpoint
CREATE TABLE `checklist_daily_states` (
	`item_id` text NOT NULL,
	`business_date` text NOT NULL,
	`checked` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`item_id`, `business_date`),
	FOREIGN KEY (`item_id`) REFERENCES `checklist_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "checklist_daily_states_checked_check" CHECK("checklist_daily_states"."checked" IN (0, 1))
);--> statement-breakpoint
CREATE INDEX `idx_checklist_daily_states_date` ON `checklist_daily_states` (`business_date`);--> statement-breakpoint
CREATE TABLE `checklist_events` (
	`id` text PRIMARY KEY NOT NULL,
	`widget_id` text NOT NULL,
	`item_id` text NOT NULL,
	`item_label` text NOT NULL,
	`action` text NOT NULL,
	`business_date` text NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`widget_id`) REFERENCES `dashboard_widgets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `checklist_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "checklist_events_action_check" CHECK("checklist_events"."action" IN ('checked', 'unchecked'))
);--> statement-breakpoint
CREATE INDEX `idx_checklist_events_widget_time` ON `checklist_events` (`widget_id`,`occurred_at`,`id`);--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;
