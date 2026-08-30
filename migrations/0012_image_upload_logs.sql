CREATE TABLE `integration_image_upload_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text,
	`outcome` text NOT NULL,
	`content_type` text,
	`declared_size` integer,
	`file_entry_id` text,
	`file_name` text,
	`http_status` integer NOT NULL,
	`error_code` text,
	`error_message` text,
	`received_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	CONSTRAINT "integration_image_upload_logs_outcome_check" CHECK("integration_image_upload_logs"."outcome" IN ('success', 'failure')),
	CONSTRAINT "integration_image_upload_logs_declared_size_check" CHECK("integration_image_upload_logs"."declared_size" IS NULL OR "integration_image_upload_logs"."declared_size" >= 0),
	CONSTRAINT "integration_image_upload_logs_http_status_check" CHECK("integration_image_upload_logs"."http_status" BETWEEN 100 AND 599),
	CONSTRAINT "integration_image_upload_logs_duration_check" CHECK("integration_image_upload_logs"."duration_ms" >= 0),
	CONSTRAINT "integration_image_upload_logs_result_check" CHECK(("integration_image_upload_logs"."outcome" = 'success' AND "integration_image_upload_logs"."file_entry_id" IS NOT NULL AND "integration_image_upload_logs"."file_name" IS NOT NULL AND "integration_image_upload_logs"."error_code" IS NULL AND "integration_image_upload_logs"."error_message" IS NULL) OR ("integration_image_upload_logs"."outcome" = 'failure' AND "integration_image_upload_logs"."file_entry_id" IS NULL AND "integration_image_upload_logs"."file_name" IS NULL AND "integration_image_upload_logs"."error_code" IS NOT NULL AND "integration_image_upload_logs"."error_message" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_integration_image_upload_logs_time` ON `integration_image_upload_logs` (`received_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_integration_image_upload_logs_profile_time` ON `integration_image_upload_logs` (`profile_id`,`received_at`,`id`);