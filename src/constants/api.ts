export const API_PATHS = {
  SESSION: "/api/session",
  FILES: "/api/files",
  FILESYSTEM: "/api/filesystem",
  WIDGETS: "/api/widgets",
} as const;

export const API_PATH_SEGMENTS = {
  MEMO: "memo",
  CHECKLIST: "checklist",
  ITEMS: "items",
  CHECK: "check",
  LOGS: "logs",
  ENTRIES: "entries",
  DIRECTORIES: "directories",
  TRASH: "trash",
  RESTORE: "restore",
} as const;

export const API_QUERY_PARAMETERS = {
  OFFSET: "offset",
  LIMIT: "limit",
  FILE_NAME: "name",
  PARENT_ID: "parentId",
} as const;
