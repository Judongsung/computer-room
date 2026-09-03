import { IMAGE_UPLOAD_LOG_ERRORS } from "@/constants/integrations/errors/image-upload-log";
import { isImageUploadLogRetentionDays } from "@/domain/integrations/image-upload-log";
import { AppError } from "@/domain/shared/errors";
import type {
  ImageUploadLogSettings,
  ImageUploadLogSettingsRepository,
  ImageUploadLogSettingsUseCases,
} from "@/types/integrations/image-upload-log";

export class ImageUploadLogSettingsService
  implements ImageUploadLogSettingsUseCases
{
  constructor(private readonly settings: ImageUploadLogSettingsRepository) {}

  getSettings(): Promise<ImageUploadLogSettings> {
    return this.settings.getSettings();
  }

  async updateRetentionDays(
    retentionDays: number,
  ): Promise<ImageUploadLogSettings> {
    if (!isImageUploadLogRetentionDays(retentionDays)) {
      throw new AppError(IMAGE_UPLOAD_LOG_ERRORS.INVALID_RETENTION_DAYS);
    }
    await this.settings.saveRetentionDays(retentionDays);
    return { retentionDays };
  }
}
