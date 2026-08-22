CREATE TABLE `filesystem_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`file_id` text,
	`restore_parent_id` text,
	`restore_path` text,
	`trashed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `filesystem_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restore_parent_id`) REFERENCES `filesystem_entries`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "filesystem_entries_kind_check" CHECK("filesystem_entries"."kind" IN ('directory', 'file')),
	CONSTRAINT "filesystem_entries_file_check" CHECK(("filesystem_entries"."kind" = 'directory' AND "filesystem_entries"."file_id" IS NULL) OR ("filesystem_entries"."kind" = 'file' AND "filesystem_entries"."file_id" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `filesystem_entries` (
	`id`, `parent_id`, `kind`, `name`, `name_key`, `file_id`,
	`restore_parent_id`, `restore_path`, `trashed_at`, `created_at`, `updated_at`
) VALUES
	('system-documents-root', NULL, 'directory', '내 문서', '내 문서', NULL, NULL, NULL, NULL, 0, 0),
	('system-recycle-bin-root', NULL, 'directory', '휴지통', '휴지통', NULL, NULL, NULL, NULL, 0, 0);--> statement-breakpoint
INSERT INTO `filesystem_entries` (
	`id`, `parent_id`, `kind`, `name`, `name_key`, `file_id`,
	`restore_parent_id`, `restore_path`, `trashed_at`, `created_at`, `updated_at`
)
WITH RECURSIVE ranked AS (
	SELECT
		`id`, `original_name`, `created_at`,
		LOWER(TRIM(`original_name`)) AS `original_key`,
		ROW_NUMBER() OVER (
			PARTITION BY LOWER(TRIM(`original_name`))
			ORDER BY `created_at`, `id`
		) AS `duplicate_number`
	FROM `files`
),
numbers (`number`) AS (
	SELECT ROW_NUMBER() OVER (ORDER BY `created_at`, `id`) + 1
	FROM `files`
),
dot_positions (`id`, `position`) AS (
	SELECT `id`, INSTR(`original_name`, '.')
	FROM ranked
	WHERE INSTR(`original_name`, '.') > 0
	UNION ALL
	SELECT
		dot_positions.`id`,
		dot_positions.`position` + INSTR(
			SUBSTR(ranked.`original_name`, dot_positions.`position` + 1),
			'.'
		)
	FROM dot_positions
	JOIN ranked ON ranked.`id` = dot_positions.`id`
	WHERE INSTR(
		SUBSTR(ranked.`original_name`, dot_positions.`position` + 1),
		'.'
	) > 0
),
prepared AS (
	SELECT
		ranked.`id`, ranked.`original_name`, ranked.`original_key`, ranked.`created_at`,
		ranked.`duplicate_number`, COALESCE(MAX(dot_positions.`position`), 0) AS `last_dot`
	FROM ranked
	LEFT JOIN dot_positions ON dot_positions.`id` = ranked.`id`
	GROUP BY ranked.`id`, ranked.`original_name`, ranked.`original_key`,
		ranked.`created_at`, ranked.`duplicate_number`
),
raw_candidates AS (
	SELECT
		prepared.`original_key`, numbers.`number`,
		CASE
			WHEN `last_dot` > 1 THEN
				SUBSTR(`original_name`, 1, `last_dot` - 1)
				|| ' (' || numbers.`number` || ')'
				|| SUBSTR(`original_name`, `last_dot`)
			ELSE `original_name` || ' (' || numbers.`number` || ')'
		END AS `display_name`
	FROM prepared
	CROSS JOIN numbers
	WHERE prepared.`duplicate_number` = 1
		AND EXISTS (
			SELECT 1
			FROM ranked duplicate
			WHERE duplicate.`original_key` = prepared.`original_key`
				AND duplicate.`duplicate_number` > 1
		)
),
available_candidates AS (
	SELECT
		raw_candidates.*,
		ROW_NUMBER() OVER (
			PARTITION BY raw_candidates.`original_key`
			ORDER BY raw_candidates.`number`
		) AS `available_number`
	FROM raw_candidates
	WHERE NOT EXISTS (
		SELECT 1
		FROM ranked existing
		WHERE existing.`original_key` = LOWER(TRIM(raw_candidates.`display_name`))
	)
),
named AS (
	SELECT `id`, `created_at`, `original_name` AS `display_name`
	FROM prepared
	WHERE `duplicate_number` = 1
	UNION ALL
	SELECT prepared.`id`, prepared.`created_at`, available_candidates.`display_name`
	FROM prepared
	JOIN available_candidates
		ON available_candidates.`original_key` = prepared.`original_key`
		AND available_candidates.`available_number` = prepared.`duplicate_number` - 1
	WHERE prepared.`duplicate_number` > 1
)
SELECT
	`id`, 'system-documents-root', 'file', `display_name`, LOWER(TRIM(`display_name`)), `id`,
	NULL, NULL, NULL, `created_at`, `created_at`
FROM named;--> statement-breakpoint
CREATE UNIQUE INDEX `filesystem_entries_file_id_unique` ON `filesystem_entries` (`file_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_filesystem_entries_active_parent_name` ON `filesystem_entries` (`parent_id`,`name_key`) WHERE "filesystem_entries"."trashed_at" IS NULL;--> statement-breakpoint
CREATE INDEX `idx_filesystem_entries_parent_kind_name` ON `filesystem_entries` (`parent_id`,`kind`,`name_key`);--> statement-breakpoint
CREATE INDEX `idx_filesystem_entries_trash` ON `filesystem_entries` (`parent_id`,`trashed_at`);
