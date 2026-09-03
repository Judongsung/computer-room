import {
  IMAGE_UPLOAD_LOG_CURSOR_ID_PATTERN,
  IMAGE_UPLOAD_LOG_CURSOR_SEPARATOR,
  IMAGE_UPLOAD_LOG_LIMITS,
  IMAGE_UPLOAD_LOG_RETENTION,
} from "@/constants/integrations/image-upload-log";
import {
  IMAGE_UPLOAD_PROFILE_ID_PATTERN,
} from "@/constants/integrations/image-upload-profile";
import {
  KOREA_UTC_OFFSET_MILLISECONDS,
  MILLISECONDS_PER_DAY,
} from "@/constants/platform/date";
import type { ImageUploadLogCursor } from "@/types/integrations/image-upload-log";

const IPV4_OCTET_PATTERN = /^(?:0|[1-9]\d{0,2})$/u;

export function imageUploadLogRetentionCutoff(
  referenceTime: number,
  retentionDays: number,
): number {
  const koreaTimestamp = referenceTime + KOREA_UTC_OFFSET_MILLISECONDS;
  const koreaDayStart =
    Math.floor(koreaTimestamp / MILLISECONDS_PER_DAY) * MILLISECONDS_PER_DAY -
    KOREA_UTC_OFFSET_MILLISECONDS;
  return koreaDayStart - retentionDays * MILLISECONDS_PER_DAY;
}

export function isImageUploadLogRetentionDays(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= IMAGE_UPLOAD_LOG_RETENTION.MIN_DAYS &&
    value <= IMAGE_UPLOAD_LOG_RETENTION.MAX_DAYS
  );
}

export function imageUploadLogSourceIp(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > IMAGE_UPLOAD_LOG_LIMITS.SOURCE_IP_MAX_LENGTH
  ) {
    return null;
  }
  return isIpv4Address(normalized) || isIpv6Address(normalized)
    ? normalized
    : null;
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

function isIpv4Address(value: string): boolean {
  const octets = value.split(".");
  return (
    octets.length === 4 &&
    octets.every(
      (octet) =>
        IPV4_OCTET_PATTERN.test(octet) && Number(octet) <= 255,
    )
  );
}

function isIpv6Address(value: string): boolean {
  if (!value.includes(":") || value.includes("%")) return false;
  try {
    const parsed = new URL(`http://[${value}]/`);
    return parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]");
  } catch {
    return false;
  }
}
