export const FILESYSTEM_ENTRY_KIND = {
  DIRECTORY: "directory",
  FILE: "file",
} as const;

export const FILESYSTEM_ENTRY_KIND_VALUES = [
  FILESYSTEM_ENTRY_KIND.DIRECTORY,
  FILESYSTEM_ENTRY_KIND.FILE,
] as const;

export const FILESYSTEM_ROOT_ID = {
  DOCUMENTS: "system-documents-root",
  RECYCLE_BIN: "system-recycle-bin-root",
} as const;

export const FILESYSTEM_ROOT_NAME = {
  DOCUMENTS: "내 문서",
  RECYCLE_BIN: "휴지통",
} as const;

export const FILESYSTEM_COPY_INDEX_START = 2;
export const FILESYSTEM_PATH_SEPARATOR = "\\";
export const R2_DELETE_BATCH_SIZE = 1_000;
