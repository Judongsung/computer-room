import type { FILE_UPLOAD_COMPENSATION_STEP } from "@/constants/filesystem/observability";

export type FileUploadCompensationStep =
  (typeof FILE_UPLOAD_COMPENSATION_STEP)[keyof typeof FILE_UPLOAD_COMPENSATION_STEP];

export interface FileUploadCompensationFailure {
  readonly step: FileUploadCompensationStep;
  readonly cause: unknown;
}

export interface FileUploadCompensationFailureEvent {
  readonly entryId: string;
  readonly failures: readonly FileUploadCompensationFailure[];
}

export interface FileUploadCompensationObserver {
  report(event: FileUploadCompensationFailureEvent): void;
}
