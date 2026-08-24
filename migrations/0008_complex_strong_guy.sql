CREATE TABLE `filesystem_directory_preferences` (
	`directory_id` text PRIMARY KEY NOT NULL,
	`sort_field` text NOT NULL,
	`sort_direction` text NOT NULL,
	FOREIGN KEY (`directory_id`) REFERENCES `filesystem_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "filesystem_directory_preferences_field_check" CHECK("filesystem_directory_preferences"."sort_field" IN ('name', 'createdAt', 'updatedAt', 'type', 'size')),
	CONSTRAINT "filesystem_directory_preferences_direction_check" CHECK("filesystem_directory_preferences"."sort_direction" IN ('ascending', 'descending'))
);
