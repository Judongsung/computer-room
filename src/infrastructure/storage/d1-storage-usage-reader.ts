import { FILE_STATUS } from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_SYSTEM_ROOT_IDS,
} from "@/constants/filesystem/filesystem";
import { STORAGE_STATUS_ERRORS } from "@/constants/storage/errors/storage-status";
import { AppError } from "@/domain/shared/errors";
import type {
  DatabaseStorageUsage,
  DatabaseStorageUsageReader,
} from "@/types/storage/storage-status";

interface StorageUsageRow {
  registered_file_count: number;
  directory_count: number;
  widget_count: number;
  trash_item_count: number;
}

export class D1StorageUsageReader implements DatabaseStorageUsageReader {
  constructor(private readonly database: D1Database) {}

  async readUsage(): Promise<DatabaseStorageUsage> {
    const result = await this.database
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM files WHERE status = ?1)
             AS registered_file_count,
           (SELECT COUNT(*) FROM filesystem_entries
             WHERE kind = ?2 AND id NOT IN (?3, ?4, ?5))
             AS directory_count,
           (SELECT COUNT(*) FROM dashboard_widgets) AS widget_count,
           (SELECT COUNT(*) FROM filesystem_entries
             WHERE parent_id = ?5 AND trashed_at IS NOT NULL)
             AS trash_item_count`,
      )
      .bind(
        FILE_STATUS.READY,
        FILESYSTEM_ENTRY_KIND.DIRECTORY,
        ...FILESYSTEM_SYSTEM_ROOT_IDS,
      )
      .all<StorageUsageRow>();
    const row = result.results[0];
    if (
      !row ||
      !isNonNegativeSafeInteger(result.meta.size_after) ||
      !isNonNegativeSafeInteger(row.registered_file_count) ||
      !isNonNegativeSafeInteger(row.directory_count) ||
      !isNonNegativeSafeInteger(row.widget_count) ||
      !isNonNegativeSafeInteger(row.trash_item_count)
    ) {
      throw new AppError(STORAGE_STATUS_ERRORS.INVALID_USAGE);
    }
    return {
      databaseBytes: result.meta.size_after,
      registeredFileCount: row.registered_file_count,
      directoryCount: row.directory_count,
      widgetCount: row.widget_count,
      trashItemCount: row.trash_item_count,
    };
  }
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
