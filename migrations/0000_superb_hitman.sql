CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`original_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`etag` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "files_size_check" CHECK("files"."size" >= 0 AND "files"."size" <= 100000000),
	CONSTRAINT "files_status_check" CHECK("files"."status" IN ('pending', 'ready'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_object_key_unique` ON `files` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_files_status_created_at` ON `files` (`status`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
