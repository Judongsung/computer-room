export const API_PATHS = {
  SESSION: "/api/session",
  FILES: "/api/files",
  FILESYSTEM: "/api/filesystem",
  INTEGRATIONS: "/api/integrations",
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
  CONTENT: "content",
  THUMBNAIL: "thumbnail",
  MOVE: "move",
  FILE: "file",
  OPEN: "open",
  CLOSE: "close",
  NOVELAI: "novelai",
  IMAGES: "images",
} as const;

export const NOVELAI_IMAGE_UPLOAD_API_PATH =
  `${API_PATHS.INTEGRATIONS}/${API_PATH_SEGMENTS.NOVELAI}/${API_PATH_SEGMENTS.IMAGES}`;

export const API_QUERY_PARAMETERS = {
  OFFSET: "offset",
  LIMIT: "limit",
  FILE_NAME: "name",
  PARENT_ID: "parentId",
  DESKTOP_TARGET_INDEX: "desktopTargetIndex",
  DESKTOP_CAPACITY: "desktopCapacity",
} as const;
