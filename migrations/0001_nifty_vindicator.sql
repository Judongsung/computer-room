CREATE TABLE `dashboard_widgets` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'blank' NOT NULL,
	`grid_column` integer NOT NULL,
	`grid_row` integer NOT NULL,
	`grid_columns` integer NOT NULL,
	`grid_rows` integer NOT NULL,
	CONSTRAINT "dashboard_widgets_type_check" CHECK("dashboard_widgets"."type" = 'blank'),
	CONSTRAINT "dashboard_widgets_column_check" CHECK("dashboard_widgets"."grid_column" >= 0 AND "dashboard_widgets"."grid_column" < 12),
	CONSTRAINT "dashboard_widgets_row_check" CHECK("dashboard_widgets"."grid_row" >= 0 AND "dashboard_widgets"."grid_row" <= 999),
	CONSTRAINT "dashboard_widgets_width_check" CHECK("dashboard_widgets"."grid_columns" >= 2 AND "dashboard_widgets"."grid_columns" <= 12),
	CONSTRAINT "dashboard_widgets_height_check" CHECK("dashboard_widgets"."grid_rows" >= 2 AND "dashboard_widgets"."grid_rows" <= 12),
	CONSTRAINT "dashboard_widgets_horizontal_bounds_check" CHECK("dashboard_widgets"."grid_column" + "dashboard_widgets"."grid_columns" <= 12)
);
--> statement-breakpoint
CREATE INDEX `idx_dashboard_widgets_position` ON `dashboard_widgets` (`grid_row`,`grid_column`);
