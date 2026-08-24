export const THUMBNAIL_SPEC = {
  CURRENT_VERSION: "v1",
  WIDTH_PX: 96,
  HEIGHT_PX: 96,
  QUALITY: 80,
  MAX_SOURCE_SIZE_BYTES: 20_000_000,
  OUTPUT_CONTENT_TYPE: "image/webp",
  FIT: "scale-down",
} as const;

export const THUMBNAIL_VERSION_VALUES = [
  THUMBNAIL_SPEC.CURRENT_VERSION,
] as const;

export const THUMBNAIL_OBJECT_KEY_PREFIX = "thumbnails";

export const THUMBNAIL_SOURCE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
