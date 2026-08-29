import { FILE_STATUS } from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import type { FilesystemEntryRow } from "@/types/platform/database";
import type {
  FilesystemEntryRecord,
  NewExactFilesystemDirectory,
  NewFilesystemDirectory,
  NewFilesystemFile,
  NewFilesystemWidget,
} from "@/types/filesystem/filesystem";
import type { FilesystemMutationRepository } from "@/types/filesystem/repository";
import {
  desktopEntryOrderInsert,
  desktopEntryOrderReplacement,
} from "@/infrastructure/filesystem/d1/desktop-entry-order-statements";
import { mapFilesystemEntryRow } from "@/infrastructure/filesystem/d1/filesystem-entry-row-mapper";
import { FILESYSTEM_ENTRY_SELECT } from "@/infrastructure/filesystem/d1/filesystem-entry-select";

export class D1FilesystemMutationRepository
  implements FilesystemMutationRepository
{
  constructor(private readonly database: D1Database) {}

  async insertDirectory(directory: NewFilesystemDirectory): Promise<void> {
    const statements = [
      this.database
        .prepare(
          `INSERT INTO filesystem_entries (
             id, parent_id, kind, name, name_key, file_id, widget_id,
             restore_parent_id, restore_path, trashed_at, created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, NULL, NULL, NULL, ?6, ?6)`,
        )
        .bind(
          directory.id,
          directory.parentId,
          FILESYSTEM_ENTRY_KIND.DIRECTORY,
          directory.name,
          directory.nameKey,
          directory.createdAt,
        ),
    ];
    if (directory.desktopOrder !== undefined) {
      statements.push(
        desktopEntryOrderInsert(
          this.database,
          directory.id,
          directory.desktopOrder,
        ),
      );
    }
    await this.database.batch(statements);
  }

  async ensureDirectory(
    directory: NewExactFilesystemDirectory,
  ): Promise<FilesystemEntryRecord> {
    const statements = [
      this.database
        .prepare(
          `INSERT OR IGNORE INTO filesystem_entries (
             id, parent_id, kind, name, name_key, file_id, widget_id,
             restore_parent_id, restore_path, trashed_at, created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, NULL, NULL, NULL, ?6, ?6)`,
        )
        .bind(
          directory.id,
          directory.parentId,
          FILESYSTEM_ENTRY_KIND.DIRECTORY,
          directory.name,
          directory.nameKey,
          directory.createdAt,
        ),
    ];

    if (directory.parentId === FILESYSTEM_ROOT_ID.DESKTOP) {
      statements.push(
        this.database
          .prepare(
            `INSERT OR IGNORE INTO desktop_entry_order (entry_id, sort_order)
             SELECT ?1, COALESCE((SELECT MAX(sort_order) + 1 FROM desktop_entry_order), 0)
             WHERE EXISTS (
               SELECT 1 FROM filesystem_entries
               WHERE id = ?1 AND parent_id = ?2 AND name_key = ?3
                 AND trashed_at IS NULL
             )`,
          )
          .bind(directory.id, directory.parentId, directory.nameKey),
      );
    }

    statements.push(
      this.database
        .prepare(
          `${FILESYSTEM_ENTRY_SELECT}
           WHERE e.parent_id = ?1 AND e.name_key = ?2 AND e.trashed_at IS NULL`,
        )
        .bind(directory.parentId, directory.nameKey),
    );
    const results = await this.database.batch<FilesystemEntryRow>(statements);
    const row = results.at(-1)?.results[0];
    if (!row) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
    }
    return mapFilesystemEntryRow(row);
  }

  async insertPendingFile(file: NewFilesystemFile): Promise<void> {
    const statements = [
      this.database
        .prepare(
          `INSERT INTO files (
             id, object_key, original_name, content_type, size, etag, status, created_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7)`,
        )
        .bind(
          file.entry.id,
          file.objectKey,
          file.entry.name,
          file.contentType,
          file.size,
          FILE_STATUS.PENDING,
          file.entry.createdAt,
        ),
      this.database
        .prepare(
          `INSERT INTO filesystem_entries (
             id, parent_id, kind, name, name_key, file_id, widget_id,
             restore_parent_id, restore_path, trashed_at, created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?1, NULL, NULL, NULL, NULL, ?6, ?6)`,
        )
        .bind(
          file.entry.id,
          file.entry.parentId,
          FILESYSTEM_ENTRY_KIND.FILE,
          file.entry.name,
          file.entry.nameKey,
          file.entry.createdAt,
        ),
    ];
    if (file.entry.desktopOrder !== undefined) {
      statements.push(
        desktopEntryOrderInsert(
          this.database,
          file.entry.id,
          file.entry.desktopOrder,
        ),
      );
    }
    await this.database.batch(statements);
  }

  async insertWidget(widget: NewFilesystemWidget): Promise<void> {
    const statements = [
      this.database
        .prepare(
          `INSERT INTO filesystem_entries (
             id, parent_id, kind, name, name_key, file_id, widget_id,
             restore_parent_id, restore_path, trashed_at, created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, NULL, NULL, NULL, ?7, ?7)`,
        )
        .bind(
          widget.id,
          widget.parentId,
          FILESYSTEM_ENTRY_KIND.WIDGET,
          widget.name,
          widget.nameKey,
          widget.widgetId,
          widget.createdAt,
        ),
    ];
    if (widget.desktopOrder !== undefined) {
      statements.push(
        desktopEntryOrderInsert(
          this.database,
          widget.id,
          widget.desktopOrder,
        ),
      );
    }
    await this.database.batch(statements);
  }

  async markFileReady(id: string, size: number, etag: string): Promise<void> {
    const result = await this.database
      .prepare(
        `UPDATE files SET size = ?2, etag = ?3, status = ?4
         WHERE id = ?1 AND status = ?5`,
      )
      .bind(id, size, etag, FILE_STATUS.READY, FILE_STATUS.PENDING)
      .run();
    if (result.meta.changes !== 1) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
    }
  }

  async deleteFileMetadata(id: string): Promise<void> {
    await this.database
      .prepare("DELETE FROM files WHERE id = ?1")
      .bind(id)
      .run();
  }

  async updateEntry(
    id: string,
    parentId: string,
    name: string,
    nameKey: string,
    updatedAt: number,
    desktopEntryIds?: readonly string[],
  ): Promise<void> {
    const statements = [
      this.database
        .prepare(
          `UPDATE filesystem_entries
           SET parent_id = ?2, name = ?3, name_key = ?4, updated_at = ?5
           WHERE id = ?1`,
        )
        .bind(id, parentId, name, nameKey, updatedAt),
    ];
    if (desktopEntryIds) {
      statements.push(
        ...desktopEntryOrderReplacement(this.database, desktopEntryIds),
      );
    }
    await this.database.batch(statements);
  }
}
