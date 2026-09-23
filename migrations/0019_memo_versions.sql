CREATE TABLE `memo_versions` (
  `widget_id` text NOT NULL,
  `version` integer NOT NULL,
  `markdown` text NOT NULL,
  `saved_at` integer,
  PRIMARY KEY(`widget_id`, `version`),
  FOREIGN KEY (`widget_id`) REFERENCES `dashboard_widgets`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `memo_versions_positive_version_check` CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `memo_versions` (`widget_id`, `version`, `markdown`, `saved_at`)
SELECT `widget_id`, 1, `markdown`, `updated_at` FROM `memo_widgets`;
