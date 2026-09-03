import { IMAGE_UPLOAD_LOG_ERRORS } from "@/constants/integrations/errors/image-upload-log";
import { IMAGE_UPLOAD_LOG_SETTINGS_SINGLETON_ID } from "@/constants/integrations/image-upload-log";
import { isImageUploadLogRetentionDays } from "@/domain/integrations/image-upload-log";
import { AppError } from "@/domain/shared/errors";
import type {
  ImageUploadLogSettings,
  ImageUploadLogSettingsRepository,
} from "@/types/integrations/image-upload-log";

interface ImageUploadLogSettingsRow {
  readonly retention_days: number;
}

export class D1ImageUploadLogSettingsRepository
  implements ImageUploadLogSettingsRepository
{
  constructor(private readonly database: D1Database) {}

  async getSettings(): Promise<ImageUploadLogSettings> {
    const row = await this.database
      .prepare(
        `SELECT retention_days
         FROM integration_image_upload_log_settings
         WHERE singleton_id = ?1`,
      )
      .bind(IMAGE_UPLOAD_LOG_SETTINGS_SINGLETON_ID)
      .first<ImageUploadLogSettingsRow>();
    if (!row || !isImageUploadLogRetentionDays(row.retention_days)) {
      throw new AppError(IMAGE_UPLOAD_LOG_ERRORS.INVALID_STORED_SETTINGS);
    }
    return { retentionDays: row.retention_days };
  }

  async saveRetentionDays(retentionDays: number): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO integration_image_upload_log_settings(
           singleton_id, retention_days
         ) VALUES (?1, ?2)
         ON CONFLICT(singleton_id) DO UPDATE SET
           retention_days = excluded.retention_days`,
      )
      .bind(IMAGE_UPLOAD_LOG_SETTINGS_SINGLETON_ID, retentionDays)
      .run();
  }
}
