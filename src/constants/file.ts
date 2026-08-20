export const MAX_FILE_SIZE_BYTES = 100_000_000;
export const MAX_FILE_NAME_BYTES = 255;
export const MAX_CONTENT_TYPE_LENGTH = 255;
export const DEFAULT_CONTENT_TYPE = "application/octet-stream";
export const FILE_OBJECT_KEY_PREFIX = "files";

export const FILE_STATUS = {
  PENDING: "pending",
  READY: "ready",
} as const;

export const FILE_STATUS_VALUES = [
  FILE_STATUS.PENDING,
  FILE_STATUS.READY,
] as const;
