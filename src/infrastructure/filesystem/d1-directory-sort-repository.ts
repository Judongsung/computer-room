import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import {
  isFilesystemSortDirection,
  isFilesystemSortField,
} from "@/domain/filesystem/filesystem-sort";
import type { DirectorySortRepository } from "@/types/filesystem/directory-sort-repository";
import type { FilesystemDirectorySort } from "@/types/filesystem/filesystem";

interface DirectorySortRow {
  readonly sort_field: string;
  readonly sort_direction: string;
}

export class D1DirectorySortRepository implements DirectorySortRepository {
  constructor(private readonly database: D1Database) {}

  async find(directoryId: string): Promise<FilesystemDirectorySort | null> {
    const row = await this.database
      .prepare(
        `SELECT sort_field, sort_direction
         FROM filesystem_directory_preferences
         WHERE directory_id = ?1`,
      )
      .bind(directoryId)
      .first<DirectorySortRow>();
    if (!row) return null;
    if (
      !isFilesystemSortField(row.sort_field) ||
      !isFilesystemSortDirection(row.sort_direction)
    ) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_DIRECTORY_SORT);
    }
    return {
      field: row.sort_field,
      direction: row.sort_direction,
    };
  }

  async save(
    directoryId: string,
    sort: FilesystemDirectorySort,
  ): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO filesystem_directory_preferences (
           directory_id, sort_field, sort_direction
         ) VALUES (?1, ?2, ?3)
         ON CONFLICT(directory_id) DO UPDATE SET
           sort_field = excluded.sort_field,
           sort_direction = excluded.sort_direction`,
      )
      .bind(directoryId, sort.field, sort.direction)
      .run();
  }
}
