export const MEDIA_KIND = {
  IMAGE: "image",
  VIDEO: "video",
} as const;

export const MEDIA_KIND_VALUES = [
  MEDIA_KIND.IMAGE,
  MEDIA_KIND.VIDEO,
] as const;

export const BYTE_RANGE_KIND = {
  CLOSED: "closed",
  OPEN: "open",
  SUFFIX: "suffix",
  INVALID: "invalid",
} as const;

export const MEDIA_CONTENT_TYPES = {
  [MEDIA_KIND.IMAGE]: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/bmp",
  ],
  [MEDIA_KIND.VIDEO]: [
    "video/mp4",
    "video/webm",
    "video/ogg",
  ],
} as const;

export const MEDIA_TYPE_PREFIX_BY_KIND = {
  [MEDIA_KIND.IMAGE]: `${MEDIA_KIND.IMAGE}/`,
  [MEDIA_KIND.VIDEO]: `${MEDIA_KIND.VIDEO}/`,
} as const;
