CREATE TABLE `mobile_preferences` (
	`singleton_id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`wallpaper_entry_id` text,
	FOREIGN KEY (`wallpaper_entry_id`) REFERENCES `filesystem_entries`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "mobile_preferences_singleton_check" CHECK("mobile_preferences"."singleton_id" = 1)
);
--> statement-breakpoint
INSERT INTO `mobile_preferences` (`singleton_id`, `wallpaper_entry_id`)
VALUES (1, NULL);
