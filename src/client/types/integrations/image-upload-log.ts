import type {
  ImageUploadLogOutcome,
  ImageUploadLogPage,
  ImageUploadLogSettings,
} from "@/types/integrations/image-upload-log";

export interface ImageUploadLogListQuery {
  readonly profileId?: string;
  readonly outcome?: ImageUploadLogOutcome;
  readonly cursor?: string;
}

export interface ImageUploadLogGateway {
  listImageUploadLogs(
    query: ImageUploadLogListQuery,
  ): Promise<ImageUploadLogPage>;
  getImageUploadLogSettings(): Promise<ImageUploadLogSettings>;
  updateImageUploadLogRetentionDays(
    retentionDays: number,
  ): Promise<ImageUploadLogSettings>;
}
