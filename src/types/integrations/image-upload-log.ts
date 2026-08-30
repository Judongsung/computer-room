import type { IMAGE_UPLOAD_LOG_OUTCOME } from "@/constants/integrations/image-upload-log";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type { AppErrorDefinition } from "@/types/platform/error";

export type ImageUploadLogOutcome =
  (typeof IMAGE_UPLOAD_LOG_OUTCOME)[keyof typeof IMAGE_UPLOAD_LOG_OUTCOME];

export interface ImageUploadLogCursor {
  readonly receivedAt: number;
  readonly id: string;
}

export interface ImageUploadLogQuery {
  readonly profileId?: string;
  readonly outcome?: ImageUploadLogOutcome;
  readonly cursor?: ImageUploadLogCursor;
}

interface ImageUploadLogAttemptBase {
  readonly profileId: string | null;
  readonly contentType: string | null;
  readonly declaredSize: number | null;
  readonly receivedAt: number;
  readonly durationMs: number;
}

export type RecordImageUploadLogInput =
  | (ImageUploadLogAttemptBase & {
      readonly outcome: typeof IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS;
      readonly file: FilesystemFileEntry;
    })
  | (ImageUploadLogAttemptBase & {
      readonly outcome: typeof IMAGE_UPLOAD_LOG_OUTCOME.FAILURE;
      readonly error: AppErrorDefinition;
    });

export interface StoredImageUploadLog {
  readonly id: string;
  readonly profileId: string | null;
  readonly outcome: ImageUploadLogOutcome;
  readonly contentType: string | null;
  readonly declaredSize: number | null;
  readonly fileEntryId: string | null;
  readonly fileName: string | null;
  readonly httpStatus: number;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly receivedAt: number;
  readonly durationMs: number;
}

export interface ImageUploadLog {
  readonly id: string;
  readonly profileId: string | null;
  readonly outcome: ImageUploadLogOutcome;
  readonly contentType: string | null;
  readonly declaredSize: number | null;
  readonly fileName: string | null;
  readonly file: FilesystemFileEntry | null;
  readonly httpStatus: number;
  readonly error:
    | {
        readonly code: string;
        readonly message: string;
      }
    | null;
  readonly receivedAt: string;
  readonly durationMs: number;
}

export interface ImageUploadLogPage {
  readonly items: readonly ImageUploadLog[];
  readonly nextCursor: string | null;
}

export interface ImageUploadLogRepositoryQuery extends ImageUploadLogQuery {
  readonly cutoff: number;
  readonly limit: number;
}

export interface ImageUploadLogRepository {
  insert(log: StoredImageUploadLog): Promise<void>;
  list(query: ImageUploadLogRepositoryQuery): Promise<StoredImageUploadLog[]>;
  purgeBefore(cutoff: number): Promise<number>;
}

export interface ImageUploadLogRecorder {
  record(input: RecordImageUploadLogInput): Promise<void>;
}

export interface ImageUploadLogUseCases extends ImageUploadLogRecorder {
  listLogs(query: ImageUploadLogQuery): Promise<ImageUploadLogPage>;
  purgeExpired(referenceTime: number): Promise<number>;
}

export interface ImageUploadLogResponse {
  readonly items: readonly ImageUploadLog[];
  readonly nextCursor: string | null;
}
