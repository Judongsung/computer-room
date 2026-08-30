import { IMAGE_UPLOAD_LOG_OUTCOME_VALUES } from "@/constants/integrations/image-upload-log";
import type {
  ImageUploadLog,
  ImageUploadLogPage,
} from "@/types/integrations/image-upload-log";
import { isFileEntry } from "@client/api/filesystem/filesystem-api-contract";
import { isRecord } from "@client/api/shared/api-contract";

export function isImageUploadLogPage(value: unknown): value is ImageUploadLogPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isImageUploadLog) &&
    (value.nextCursor === null || typeof value.nextCursor === "string")
  );
}

function isImageUploadLog(value: unknown): value is ImageUploadLog {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.profileId === null || typeof value.profileId === "string") &&
    IMAGE_UPLOAD_LOG_OUTCOME_VALUES.some(
      (outcome) => outcome === value.outcome,
    ) &&
    (value.contentType === null || typeof value.contentType === "string") &&
    (value.declaredSize === null || isNonNegativeNumber(value.declaredSize)) &&
    (value.fileName === null || typeof value.fileName === "string") &&
    (value.file === null || isFileEntry(value.file)) &&
    isHttpStatus(value.httpStatus) &&
    (value.error === null || isLogError(value.error)) &&
    typeof value.receivedAt === "string" &&
    isNonNegativeNumber(value.durationMs)
  );
}

function isLogError(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function isHttpStatus(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
  );
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
