CREATE TABLE `integration_image_upload_log_settings` (
	`singleton_id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`retention_days` integer DEFAULT 30 NOT NULL,
	CONSTRAINT "integration_image_upload_log_settings_singleton_check" CHECK("integration_image_upload_log_settings"."singleton_id" = 1),
	CONSTRAINT "integration_image_upload_log_settings_retention_check" CHECK("integration_image_upload_log_settings"."retention_days" BETWEEN 1 AND 365)
);
--> statement-breakpoint
INSERT INTO `integration_image_upload_log_settings` (`singleton_id`, `retention_days`)
VALUES (1, 30);
--> statement-breakpoint
ALTER TABLE `integration_image_upload_logs` ADD `source_ip` text;
