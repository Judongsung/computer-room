PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	CONSTRAINT "dashboard_widgets_type_check" CHECK("__new_dashboard_widgets"."type" IN ('memo', 'daily-checklist')),
	CONSTRAINT "dashboard_widgets_position_x_check" CHECK("__new_dashboard_widgets"."position_x" BETWEEN 0 AND 8192),
	CONSTRAINT "dashboard_widgets_position_y_check" CHECK("__new_dashboard_widgets"."position_y" BETWEEN 0 AND 8192),
	CONSTRAINT "dashboard_widgets_width_check" CHECK("__new_dashboard_widgets"."width" > 0 AND "__new_dashboard_widgets"."width" <= 4096),
	CONSTRAINT "dashboard_widgets_height_check" CHECK("__new_dashboard_widgets"."height" > 0 AND "__new_dashboard_widgets"."height" <= 2160),
	CONSTRAINT "dashboard_widgets_window_state_check" CHECK("__new_dashboard_widgets"."window_state" IN ('normal', 'minimized', 'maximized')),
	CONSTRAINT "dashboard_widgets_restore_state_check" CHECK("__new_dashboard_widgets"."restore_state" IN ('normal', 'maximized')),
	CONSTRAINT "dashboard_widgets_stack_order_check" CHECK("__new_dashboard_widgets"."stack_order" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_dashboard_widgets`("id", "type", "position_x", "position_y", "width", "height", "window_state", "restore_state", "stack_order")
SELECT
	"id",
	"type",
	"grid_column" * 101,
	"grid_row" * 60,
	MAX("grid_columns" * 101 - 12, CASE "type" WHEN 'memo' THEN 320 ELSE 360 END),
	MAX("grid_rows" * 60 - 12, CASE "type" WHEN 'memo' THEN 220 ELSE 280 END),
	'normal',
	'normal',
	ROW_NUMBER() OVER (ORDER BY "grid_row", "grid_column", "id") - 1
FROM `dashboard_widgets`;--> statement-breakpoint
DROP TABLE `dashboard_widgets`;--> statement-breakpoint
ALTER TABLE `__new_dashboard_widgets` RENAME TO `dashboard_widgets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_dashboard_widgets_stack_order` ON `dashboard_widgets` (`stack_order`);
