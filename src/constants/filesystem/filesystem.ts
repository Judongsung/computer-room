export const FILESYSTEM_ENTRY_KIND = {
  DIRECTORY: "directory",
  FILE: "file",
  WIDGET: "widget",
} as const;

export const FILESYSTEM_ENTRY_KIND_VALUES = [
  FILESYSTEM_ENTRY_KIND.DIRECTORY,
  FILESYSTEM_ENTRY_KIND.FILE,
  FILESYSTEM_ENTRY_KIND.WIDGET,
] as const;

export const FILESYSTEM_ROOT_ID = {
  DESKTOP: "system-desktop-root",
  DOCUMENTS: "system-documents-root",
  RECYCLE_BIN: "system-recycle-bin-root",
} as const;

export const FILESYSTEM_ROOT_NAME = {
  DESKTOP: "바탕 화면",
  DOCUMENTS: "내 문서",
  RECYCLE_BIN: "휴지통",
} as const;

export const FILESYSTEM_ACTIVE_ROOT_IDS = [
  FILESYSTEM_ROOT_ID.DESKTOP,
  FILESYSTEM_ROOT_ID.DOCUMENTS,
] as const;

export const FILESYSTEM_SYSTEM_ROOT_IDS = [
  ...FILESYSTEM_ACTIVE_ROOT_IDS,
  FILESYSTEM_ROOT_ID.RECYCLE_BIN,
] as const;

export const FILESYSTEM_COPY_INDEX_START = 2;
export const FILESYSTEM_PATH_SEPARATOR = "\\";
export const R2_DELETE_BATCH_SIZE = 1_000;
