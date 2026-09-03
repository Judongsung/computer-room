import { BACKGROUND_TASK_FAILURE_CODE } from "@/constants/platform/background-task";
import { imageUploadLogRetentionCutoff } from "@/domain/integrations/image-upload-log";
import type {
  ImageUploadLogRepository,
  ImageUploadLogSettingsReader,
} from "@/types/integrations/image-upload-log";
import type { ScheduledJob } from "@/types/platform/scheduled-job";

export class ImageUploadLogPurgeJob implements ScheduledJob {
  readonly failureCode =
    BACKGROUND_TASK_FAILURE_CODE.IMAGE_UPLOAD_LOG_PURGE;

  constructor(
    private readonly logs: Pick<ImageUploadLogRepository, "purgeBefore">,
    private readonly settings: ImageUploadLogSettingsReader,
  ) {}

  async run(scheduledTime: number): Promise<number> {
    const settings = await this.settings.getSettings();
    return this.logs.purgeBefore(
      imageUploadLogRetentionCutoff(scheduledTime, settings.retentionDays),
    );
  }
}
