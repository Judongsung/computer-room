import { FILE_STATUS } from "../constants/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "../constants/filesystem";
import { FILESYSTEM_ERRORS } from "../constants/errors/filesystem";
import { AppError } from "../domain/errors";
import type { FilesystemEntryRow } from "../types/database";
import type {
  FilesystemBreadcrumb,
  FilesystemEntryRecord,
  FilesystemFileObject,
  NewFilesystemDirectory,
  NewFilesystemFile,
} from "../types/filesystem";
import type { FilesystemRepository } from "../types/repository";

const ENTRY_SELECT = `
  SELECT e.id, e.parent_id, e.kind, e.name, e.name_key, e.file_id,
         e.restore_parent_id, e.restore_path, e.trashed_at,
         e.created_at, e.updated_at,
         f.object_key, f.content_type, f.size, f.etag, f.status AS file_status
  FROM filesystem_entries e
  LEFT JOIN files f ON f.id = e.file_id`;

interface BreadcrumbRow {
  id: string;
  name: string;
  depth: number;
}

interface NameKeyRow {
  name_key: string;
}

interface IdRow {
  id: string;
}

interface ExistsRow {
  found: number;
}

interface FileObjectRow {
  id: string;
  object_key: string;
}

export class D1FilesystemRepository implements FilesystemRepository {
  constructor(private readonly database: D1Database) {}

  async findEntry(id: string): Promise<FilesystemEntryRecord | null> {
    const row = await this.database
      .prepare(`${ENTRY_SELECT} WHERE e.id = ?1`)
      .bind(id)
      .first<FilesystemEntryRow>();
    return row ? mapEntryRow(row) : null;
  }

  async listChildren(
    parentId: string,
    offset: number,
    limit: number,
  ): Promise<FilesystemEntryRecord[]> {
    const result = await this.database
      .prepare(
        `${ENTRY_SELECT}
         WHERE e.parent_id = ?1
           AND e.trashed_at IS NULL
           AND (e.kind = ?2 OR f.status = ?3)
         ORDER BY CASE e.kind WHEN ?2 THEN 0 ELSE 1 END,
                  e.name_key ASC, e.id ASC
         LIMIT ?4 OFFSET ?5`,
      )
      .bind(
        parentId,
        FILESYSTEM_ENTRY_KIND.DIRECTORY,
        FILE_STATUS.READY,
        limit,
        offset,
      )
      .all<FilesystemEntryRow>();
    return result.results.map(mapEntryRow);
  }

  async listActiveFiles(
    offset: number,
    limit: number,
  ): Promise<FilesystemEntryRecord[]> {
    const result = await this.database
      .prepare(
        `WITH RECURSIVE documents(id) AS (
           SELECT id FROM filesystem_entries WHERE id = ?1
           UNION ALL
           SELECT child.id
           FROM filesystem_entries child
           JOIN documents parent ON child.parent_id = parent.id
           WHERE child.trashed_at IS NULL
         )
         ${ENTRY_SELECT}
         JOIN documents ON documents.id = e.id
         WHERE e.kind = ?2 AND f.status = ?3
         ORDER BY e.created_at DESC, e.id DESC
         LIMIT ?4 OFFSET ?5`,
      )
      .bind(
        FILESYSTEM_ROOT_ID.DOCUMENTS,
        FILESYSTEM_ENTRY_KIND.FILE,
        FILE_STATUS.READY,
        limit,
        offset,
      )
      .all<FilesystemEntryRow>();
    return result.results.map(mapEntryRow);
  }

  async listBreadcrumbs(
    directoryId: string,
  ): Promise<FilesystemBreadcrumb[]> {
    const result = await this.database
      .prepare(
        `WITH RECURSIVE ancestors(id, parent_id, name, depth) AS (
           SELECT id, parent_id, name, 0
           FROM filesystem_entries
           WHERE id = ?1
           UNION ALL
           SELECT parent.id, parent.parent_id, parent.name, ancestors.depth + 1
           FROM filesystem_entries parent
           JOIN ancestors ON parent.id = ancestors.parent_id
         )
         SELECT id, name, depth
         FROM ancestors
         WHERE id != ?2
         ORDER BY depth DESC`,
      )
      .bind(directoryId, FILESYSTEM_ROOT_ID.RECYCLE_BIN)
      .all<BreadcrumbRow>();
    return result.results.map(({ id, name }) => ({ id, name }));
  }

  async listNameKeys(parentId: string, excludeId?: string): Promise<string[]> {
    const statement = excludeId
      ? this.database
          .prepare(
            `SELECT name_key FROM filesystem_entries
             WHERE parent_id = ?1 AND trashed_at IS NULL AND id != ?2`,
          )
          .bind(parentId, excludeId)
      : this.database
          .prepare(
            `SELECT name_key FROM filesystem_entries
             WHERE parent_id = ?1 AND trashed_at IS NULL`,
          )
          .bind(parentId);
    const result = await statement.all<NameKeyRow>();
    return result.results.map((row) => row.name_key);
  }

  async isWithinRoot(entryId: string, rootId: string): Promise<boolean> {
    const row = await this.database
      .prepare(
        `WITH RECURSIVE ancestors(id, parent_id) AS (
           SELECT id, parent_id FROM filesystem_entries WHERE id = ?1
           UNION ALL
           SELECT parent.id, parent.parent_id
           FROM filesystem_entries parent
           JOIN ancestors ON parent.id = ancestors.parent_id
         )
         SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = ?2) AS found`,
      )
      .bind(entryId, rootId)
      .first<ExistsRow>();
    return row?.found === 1;
  }

  async isDescendant(entryId: string, candidateId: string): Promise<boolean> {
    const row = await this.database
      .prepare(
        `WITH RECURSIVE descendants(id) AS (
           SELECT id FROM filesystem_entries WHERE parent_id = ?1
           UNION ALL
           SELECT child.id
           FROM filesystem_entries child
           JOIN descendants parent ON child.parent_id = parent.id
         )
         SELECT EXISTS(SELECT 1 FROM descendants WHERE id = ?2) AS found`,
      )
      .bind(entryId, candidateId)
      .first<ExistsRow>();
    return row?.found === 1;
  }

  async insertDirectory(directory: NewFilesystemDirectory): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO filesystem_entries (
           id, parent_id, kind, name, name_key, file_id,
           restore_parent_id, restore_path, trashed_at, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, NULL, NULL, ?6, ?6)`,
      )
      .bind(
        directory.id,
        directory.parentId,
        FILESYSTEM_ENTRY_KIND.DIRECTORY,
        directory.name,
        directory.nameKey,
        directory.createdAt,
      )
      .run();
  }

  async insertPendingFile(file: NewFilesystemFile): Promise<void> {
    await this.database.batch([
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
             id, parent_id, kind, name, name_key, file_id,
             restore_parent_id, restore_path, trashed_at, created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?1, NULL, NULL, NULL, ?6, ?6)`,
        )
        .bind(
          file.entry.id,
          file.entry.parentId,
          FILESYSTEM_ENTRY_KIND.FILE,
          file.entry.name,
          file.entry.nameKey,
          file.entry.createdAt,
        ),
    ]);
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
    await this.database.prepare("DELETE FROM files WHERE id = ?1").bind(id).run();
  }

  async updateEntry(
    id: string,
    parentId: string,
    name: string,
    nameKey: string,
    updatedAt: number,
  ): Promise<void> {
    await this.database
      .prepare(
        `UPDATE filesystem_entries
         SET parent_id = ?2, name = ?3, name_key = ?4, updated_at = ?5
         WHERE id = ?1`,
      )
      .bind(id, parentId, name, nameKey, updatedAt)
      .run();
  }

  async moveToTrash(
    id: string,
    previousParentId: string,
    restorePath: string,
    trashedAt: number,
  ): Promise<void> {
    await this.database
      .prepare(
        `UPDATE filesystem_entries
         SET parent_id = ?2, restore_parent_id = ?3, restore_path = ?4,
             trashed_at = ?5, updated_at = ?5
         WHERE id = ?1`,
      )
      .bind(
        id,
        FILESYSTEM_ROOT_ID.RECYCLE_BIN,
        previousParentId,
        restorePath,
        trashedAt,
      )
      .run();
  }

  async restoreEntry(
    id: string,
    parentId: string,
    name: string,
    nameKey: string,
    updatedAt: number,
  ): Promise<void> {
    await this.database
      .prepare(
        `UPDATE filesystem_entries
         SET parent_id = ?2, name = ?3, name_key = ?4,
             restore_parent_id = NULL, restore_path = NULL,
             trashed_at = NULL, updated_at = ?5
         WHERE id = ?1`,
      )
      .bind(id, parentId, name, nameKey, updatedAt)
      .run();
  }

  async listTrash(
    offset: number,
    limit: number,
  ): Promise<FilesystemEntryRecord[]> {
    const result = await this.database
      .prepare(
        `${ENTRY_SELECT}
         WHERE e.parent_id = ?1 AND e.trashed_at IS NOT NULL
         ORDER BY e.trashed_at DESC, e.id DESC
         LIMIT ?2 OFFSET ?3`,
      )
      .bind(FILESYSTEM_ROOT_ID.RECYCLE_BIN, limit, offset)
      .all<FilesystemEntryRow>();
    return result.results.map(mapEntryRow);
  }

  async listTrashRootIds(): Promise<string[]> {
    const result = await this.database
      .prepare(
        `SELECT id FROM filesystem_entries
         WHERE parent_id = ?1 AND trashed_at IS NOT NULL
         ORDER BY trashed_at ASC, id ASC`,
      )
      .bind(FILESYSTEM_ROOT_ID.RECYCLE_BIN)
      .all<IdRow>();
    return result.results.map((row) => row.id);
  }

  async listSubtreeFileObjects(
    rootId: string,
  ): Promise<FilesystemFileObject[]> {
    const result = await this.database
      .prepare(
        `WITH RECURSIVE subtree(id, file_id) AS (
           SELECT id, file_id FROM filesystem_entries WHERE id = ?1
           UNION ALL
           SELECT child.id, child.file_id
           FROM filesystem_entries child
           JOIN subtree parent ON child.parent_id = parent.id
         )
         SELECT f.id, f.object_key
         FROM subtree
         JOIN files f ON f.id = subtree.file_id
         ORDER BY f.id`,
      )
      .bind(rootId)
      .all<FileObjectRow>();
    return result.results.map((row) => ({
      id: row.id,
      objectKey: row.object_key,
    }));
  }

  async purgeEntry(rootId: string): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(
          `DELETE FROM files
           WHERE id IN (
             WITH RECURSIVE subtree(id, file_id) AS (
               SELECT id, file_id FROM filesystem_entries WHERE id = ?1
               UNION ALL
               SELECT child.id, child.file_id
               FROM filesystem_entries child
               JOIN subtree parent ON child.parent_id = parent.id
             )
             SELECT file_id FROM subtree WHERE file_id IS NOT NULL
           )`,
        )
        .bind(rootId),
      this.database
        .prepare("DELETE FROM filesystem_entries WHERE id = ?1")
        .bind(rootId),
    ]);
  }
}

function mapEntryRow(row: FilesystemEntryRow): FilesystemEntryRecord {
  if (
    row.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY &&
    row.kind !== FILESYSTEM_ENTRY_KIND.FILE
  ) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  if (
    row.file_status !== null &&
    row.file_status !== FILE_STATUS.PENDING &&
    row.file_status !== FILE_STATUS.READY
  ) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  return {
    id: row.id,
    parentId: row.parent_id,
    kind: row.kind,
    name: row.name,
    nameKey: row.name_key,
    fileId: row.file_id,
    restoreParentId: row.restore_parent_id,
    restorePath: row.restore_path,
    trashedAt: row.trashed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    objectKey: row.object_key,
    contentType: row.content_type,
    size: row.size,
    etag: row.etag,
    fileStatus: row.file_status,
  };
}
