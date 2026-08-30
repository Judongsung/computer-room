import {
  IMAGE_UPLOAD_LOG_OUTCOME,
  IMAGE_UPLOAD_LOG_OUTCOME_VALUES,
} from "@/constants/integrations/image-upload-log";
import { IMAGE_UPLOAD_LOG_ERRORS } from "@/constants/integrations/errors/image-upload-log";
import { AppError } from "@/domain/shared/errors";
import type {
  ImageUploadLogOutcome,
  ImageUploadLogRepository,
  ImageUploadLogRepositoryQuery,
  StoredImageUploadLog,
} from "@/types/integrations/image-upload-log";

interface ImageUploadLogRow {
  readonly id: string;
  readonly profile_id: string | null;
  readonly outcome: string;
  readonly content_type: string | null;
  readonly declared_size: number | null;
  readonly file_entry_id: string | null;
  readonly file_name: string | null;
  readonly http_status: number;
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly received_at: number;
  readonly duration_ms: number;
}

export class D1ImageUploadLogRepository implements ImageUploadLogRepository {
  constructor(private readonly database: D1Database) {}

  async insert(log: StoredImageUploadLog): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO integration_image_upload_logs (
           id, profile_id, outcome, content_type, declared_size,
           file_entry_id, file_name, http_status, error_code, error_message,
           received_at, duration_ms
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
      )
      .bind(
        log.id,
        log.profileId,
        log.outcome,
        log.contentType,
        log.declaredSize,
        log.fileEntryId,
        log.fileName,
        log.httpStatus,
        log.errorCode,
        log.errorMessage,
        log.receivedAt,
        log.durationMs,
      )
      .run();
  }

  async list(query: ImageUploadLogRepositoryQuery): Promise<StoredImageUploadLog[]> {
    const bindings: unknown[] = [query.cutoff];
    const conditions = ["received_at >= ?1"];
    const bind = (value: unknown): string => {
      bindings.push(value);
      return `?${bindings.length}`;
    };
    if (query.profileId !== undefined) {
      conditions.push(`profile_id = ${bind(query.profileId)}`);
    }
    if (query.outcome !== undefined) {
      conditions.push(`outcome = ${bind(query.outcome)}`);
    }
    if (query.cursor) {
      const receivedAt = bind(query.cursor.receivedAt);
      const id = bind(query.cursor.id);
      conditions.push(
        `(received_at < ${receivedAt} OR (received_at = ${receivedAt} AND id < ${id}))`,
      );
    }
    const limit = bind(query.limit);
    const result = await this.database
      .prepare(
        `SELECT id, profile_id, outcome, content_type, declared_size,
                file_entry_id, file_name, http_status, error_code, error_message,
                received_at, duration_ms
         FROM integration_image_upload_logs
         WHERE ${conditions.join(" AND ")}
         ORDER BY received_at DESC, id DESC
         LIMIT ${limit}`,
      )
      .bind(...bindings)
      .all<ImageUploadLogRow>();
    return result.results.map(mapImageUploadLogRow);
  }

  async purgeBefore(cutoff: number): Promise<number> {
    const result = await this.database
      .prepare("DELETE FROM integration_image_upload_logs WHERE received_at < ?1")
      .bind(cutoff)
      .run();
    return result.meta.changes;
  }
}

function mapImageUploadLogRow(row: ImageUploadLogRow): StoredImageUploadLog {
  const outcome = IMAGE_UPLOAD_LOG_OUTCOME_VALUES.find(
    (candidate) => candidate === row.outcome,
  );
  if (!outcome || !isValidResult(row, outcome)) {
    throw new AppError(IMAGE_UPLOAD_LOG_ERRORS.INVALID_STORED_LOG);
  }
  return {
    id: row.id,
    profileId: row.profile_id,
    outcome,
    contentType: row.content_type,
    declaredSize: row.declared_size,
    fileEntryId: row.file_entry_id,
    fileName: row.file_name,
    httpStatus: row.http_status,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    receivedAt: row.received_at,
    durationMs: row.duration_ms,
  };
}

function isValidResult(
  row: ImageUploadLogRow,
  outcome: ImageUploadLogOutcome,
): boolean {
  if (outcome === IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS) {
    return Boolean(
      row.file_entry_id &&
        row.file_name &&
        row.error_code === null &&
        row.error_message === null,
    );
  }
  return Boolean(
    row.file_entry_id === null &&
      row.file_name === null &&
      row.error_code &&
      row.error_message,
  );
}
