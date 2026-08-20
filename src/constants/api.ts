export const API_PATHS = {
  SESSION: "/api/session",
  FILES: "/api/files",
  WIDGETS: "/api/widgets",
} as const;

export const API_QUERY_PARAMETERS = {
  OFFSET: "offset",
  LIMIT: "limit",
  FILE_NAME: "name",
} as const;
