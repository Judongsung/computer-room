import { FILE_OBJECT_KEY_PREFIX } from "./file";
import { THUMBNAIL_OBJECT_KEY_PREFIX } from "./thumbnail";

export const STORAGE_MIME_CATEGORY = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  DOCUMENT: "document",
  ARCHIVE: "archive",
  OTHER: "other",
} as const;

export const STORAGE_MIME_CATEGORY_VALUES = [
  STORAGE_MIME_CATEGORY.IMAGE,
  STORAGE_MIME_CATEGORY.VIDEO,
  STORAGE_MIME_CATEGORY.AUDIO,
  STORAGE_MIME_CATEGORY.DOCUMENT,
  STORAGE_MIME_CATEGORY.ARCHIVE,
  STORAGE_MIME_CATEGORY.OTHER,
] as const;

export const STORAGE_OBJECT_PURPOSE = {
  ORIGINAL: "original",
  THUMBNAIL: "thumbnail",
  OTHER: "other",
} as const;

export const STORAGE_OBJECT_PURPOSE_VALUES = [
  STORAGE_OBJECT_PURPOSE.ORIGINAL,
  STORAGE_OBJECT_PURPOSE.THUMBNAIL,
  STORAGE_OBJECT_PURPOSE.OTHER,
] as const;

export const STORAGE_OBJECT_PREFIX_BY_PURPOSE = {
  [STORAGE_OBJECT_PURPOSE.ORIGINAL]: `${FILE_OBJECT_KEY_PREFIX}/`,
  [STORAGE_OBJECT_PURPOSE.THUMBNAIL]: `${THUMBNAIL_OBJECT_KEY_PREFIX}/`,
} as const;

export const R2_STORAGE_CLASS = {
  STANDARD: "Standard",
} as const;

export const R2_STORAGE_USAGE_LIST_LIMIT = 1_000;

export const STORAGE_FREE_REFERENCE_BYTES = {
  R2_STANDARD: 10_000_000_000,
  D1_DATABASE: 500_000_000,
} as const;

export const STORAGE_USAGE_WARNING_PERCENT = 80;
export const STORAGE_USAGE_LIMIT_PERCENT = 100;

export const DOCUMENT_CONTENT_TYPES = [
  "application/json",
  "application/ld+json",
  "application/pdf",
  "application/rtf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/xml",
] as const;

export const ARCHIVE_CONTENT_TYPES = [
  "application/gzip",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-bzip2",
  "application/x-rar-compressed",
  "application/x-tar",
  "application/zip",
  "application/zstd",
] as const;
