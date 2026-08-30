import {
  IMAGE_UPLOAD_LOG_CURSOR_ID_PATTERN,
  IMAGE_UPLOAD_LOG_CURSOR_SEPARATOR,
  IMAGE_UPLOAD_LOG_RETENTION_MILLISECONDS,
} from "@/constants/integrations/image-upload-log";
import {
  IMAGE_UPLOAD_PROFILE_ID_PATTERN,
} from "@/constants/integrations/image-upload-profile";
import {
  KOREA_UTC_OFFSET_MILLISECONDS,
  MILLISECONDS_PER_DAY,
} from "@/constants/platform/date";
import type { ImageUploadLogCursor } from "@/types/integrations/image-upload-log";

export function imageUploadLogRetentionCutoff(referenceTime: number): number {
  const koreaTimestamp = referenceTime + KOREA_UTC_OFFSET_MILLISECONDS;
  const koreaDayStart =
    Math.floor(koreaTimestamp / MILLISECONDS_PER_DAY) * MILLISECONDS_PER_DAY -
    KOREA_UTC_OFFSET_MILLISECONDS;
  return koreaDayStart - IMAGE_UPLOAD_LOG_RETENTION_MILLISECONDS;
}

export function imageUploadLogProfileId(value: string): string | null {
  return IMAGE_UPLOAD_PROFILE_ID_PATTERN.test(value) ? value : null;
}

export function encodeImageUploadLogCursor(
  cursor: ImageUploadLogCursor,
): string {
  return `${cursor.receivedAt}${IMAGE_UPLOAD_LOG_CURSOR_SEPARATOR}${cursor.id}`;
}

export function decodeImageUploadLogCursor(
  value: string,
): ImageUploadLogCursor | null {
  const separatorIndex = value.indexOf(IMAGE_UPLOAD_LOG_CURSOR_SEPARATOR);
  if (separatorIndex < 1) return null;
  const receivedAt = Number(value.slice(0, separatorIndex));
  const id = value.slice(separatorIndex + IMAGE_UPLOAD_LOG_CURSOR_SEPARATOR.length);
  if (
    !Number.isSafeInteger(receivedAt) ||
    receivedAt < 0 ||
    !IMAGE_UPLOAD_LOG_CURSOR_ID_PATTERN.test(id)
  ) {
    return null;
  }
  return { receivedAt, id };
}
