import { FILE_ERRORS } from "../constants/errors/file";
import { FILE_STATUS } from "../constants/file";
import { AppError } from "../domain/errors";
import type { FileRow } from "../types/database";
import type { FileMetadata } from "../types/file";
import type { FileMetadataRepository } from "../types/repository";

export class D1FileMetadataRepository implements FileMetadataRepository {
  constructor(private readonly database: D1Database) {}

  async insertPending(file: FileMetadata): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO files (
          id, object_key, original_name, content_type, size, etag, status, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7)`,
      )
      .bind(
        file.id,
        file.objectKey,
        file.originalName,
        file.contentType,
        file.size,
        FILE_STATUS.PENDING,
        file.createdAt,
      )
      .run();
  }

  async markReady(id: string, size: number, etag: string): Promise<void> {
    const result = await this.database
      .prepare(
        `UPDATE files
         SET size = ?2, etag = ?3, status = ?4
         WHERE id = ?1 AND status = ?5`,
      )
      .bind(id, size, etag, FILE_STATUS.READY, FILE_STATUS.PENDING)
      .run();

    if (result.meta.changes !== 1) {
      throw new AppError(FILE_ERRORS.METADATA_UPDATE_FAILED);
    }
  }

  async findReadyById(id: string): Promise<FileMetadata | null> {
    const row = await this.database
      .prepare(
        `SELECT id, object_key, original_name, content_type, size, etag, status, created_at
         FROM files
         WHERE id = ?1 AND status = ?2`,
      )
      .bind(id, FILE_STATUS.READY)
      .first<FileRow>();

    return row ? mapFileRow(row) : null;
  }

  async listReady(offset: number, limit: number): Promise<FileMetadata[]> {
    const result = await this.database
      .prepare(
        `SELECT id, object_key, original_name, content_type, size, etag, status, created_at
         FROM files
         WHERE status = ?1
         ORDER BY created_at DESC, id DESC
         LIMIT ?2 OFFSET ?3`,
      )
      .bind(FILE_STATUS.READY, limit, offset)
      .all<FileRow>();

    return result.results.map(mapFileRow);
  }

  async delete(id: string): Promise<void> {
    await this.database.prepare("DELETE FROM files WHERE id = ?1").bind(id).run();
  }
}

function mapFileRow(row: FileRow): FileMetadata {
  if (row.status !== FILE_STATUS.PENDING && row.status !== FILE_STATUS.READY) {
    throw new AppError(FILE_ERRORS.INVALID_STORED_FILE);
  }

  return {
    id: row.id,
    objectKey: row.object_key,
    originalName: row.original_name,
    contentType: row.content_type,
    size: row.size,
    etag: row.etag,
    status: row.status,
    createdAt: row.created_at,
  };
}
