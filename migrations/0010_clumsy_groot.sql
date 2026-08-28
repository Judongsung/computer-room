CREATE TABLE `integration_image_profile_content_types` (
	`profile_id` text NOT NULL,
	`content_type` text NOT NULL,
	PRIMARY KEY(`profile_id`, `content_type`),
	FOREIGN KEY (`profile_id`) REFERENCES `integration_image_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "integration_image_profile_content_types_value_check" CHECK("integration_image_profile_content_types"."content_type" IN ('image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/bmp'))
);
--> statement-breakpoint
CREATE TABLE `integration_image_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`root_id` text NOT NULL,
	`path_template` text NOT NULL,
	`file_name_template` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "integration_image_profiles_root_check" CHECK("integration_image_profiles"."root_id" IN ('system-desktop-root', 'system-documents-root')),
	CONSTRAINT "integration_image_profiles_enabled_check" CHECK("integration_image_profiles"."enabled" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `idx_integration_image_profiles_enabled` ON `integration_image_profiles` (`enabled`);
--> statement-breakpoint
INSERT INTO `integration_image_profiles` (
	`id`, `display_name`, `root_id`, `path_template`, `file_name_template`,
	`enabled`, `created_at`, `updated_at`
) VALUES (
	'novelai', 'NovelAI', 'system-desktop-root', 'NovelAI/{yyyy-MM-dd}',
	'{HH-mm-ss-SSS}_{uuid}.{ext}', 1, 1787842800000, 1787842800000
);
--> statement-breakpoint
INSERT INTO `integration_image_profile_content_types` (`profile_id`, `content_type`)
VALUES
	('novelai', 'image/jpeg'),
	('novelai', 'image/png'),
	('novelai', 'image/gif'),
	('novelai', 'image/webp'),
	('novelai', 'image/avif'),
	('novelai', 'image/bmp');
