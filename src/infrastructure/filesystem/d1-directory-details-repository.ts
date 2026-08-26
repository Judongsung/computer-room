import { FILE_STATUS } from "@/constants/filesystem/file";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import type {
  DirectoryDetailsRepository,
  FilesystemDirectoryStatistics,
} from "@/types/filesystem/directory-details";

interface DirectoryStatisticsRow {
  readonly total_bytes: number;
  readonly file_count: number;
  readonly directory_count: number;
  readonly widget_count: number;
}

export class D1DirectoryDetailsRepository
  implements DirectoryDetailsRepository
{
  constructor(private readonly database: D1Database) {}

  async readStatistics(
    directoryId: string,
  ): Promise<FilesystemDirectoryStatistics> {
    const row = await this.database
      .prepare(
        `WITH RECURSIVE subtree(id, kind, file_id, widget_id) AS (
           SELECT id, kind, file_id, widget_id
           FROM filesystem_entries
           WHERE id = ?1 AND kind = ?2 AND trashed_at IS NULL
           UNION ALL
           SELECT child.id, child.kind, child.file_id, child.widget_id
           FROM filesystem_entries child
           JOIN subtree parent ON child.parent_id = parent.id
           WHERE child.trashed_at IS NULL
         )
         SELECT
           COALESCE(SUM(CASE
             WHEN subtree.kind = ?3 AND files.status = ?4 THEN files.size
             ELSE 0
           END), 0) AS total_bytes,
           COALESCE(SUM(CASE
             WHEN subtree.kind = ?3 AND files.status = ?4 THEN 1
             ELSE 0
           END), 0) AS file_count,
           COALESCE(SUM(CASE
             WHEN subtree.kind = ?2 AND subtree.id != ?1 THEN 1
             ELSE 0
           END), 0) AS directory_count,
           COALESCE(SUM(CASE
             WHEN subtree.kind = ?5 AND widgets.id IS NOT NULL THEN 1
             ELSE 0
           END), 0) AS widget_count
         FROM subtree
         LEFT JOIN files ON files.id = subtree.file_id
         LEFT JOIN dashboard_widgets widgets ON widgets.id = subtree.widget_id`,
      )
      .bind(
        directoryId,
        FILESYSTEM_ENTRY_KIND.DIRECTORY,
        FILESYSTEM_ENTRY_KIND.FILE,
        FILE_STATUS.READY,
        FILESYSTEM_ENTRY_KIND.WIDGET,
      )
      .first<DirectoryStatisticsRow>();

    if (
      !row ||
      !isNonNegativeSafeInteger(row.total_bytes) ||
      !isNonNegativeSafeInteger(row.file_count) ||
      !isNonNegativeSafeInteger(row.directory_count) ||
      !isNonNegativeSafeInteger(row.widget_count)
    ) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
    }
    return {
      totalBytes: row.total_bytes,
      fileCount: row.file_count,
      directoryCount: row.directory_count,
      widgetCount: row.widget_count,
    };
  }
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
