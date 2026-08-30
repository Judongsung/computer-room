import type {
  ImageUploadLogOutcome,
  ImageUploadLogPage,
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
}
