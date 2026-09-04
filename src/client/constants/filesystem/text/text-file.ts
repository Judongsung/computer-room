export const TEXT_FILE_MAX_BYTES = 2 * 1024 * 1024;
export const TEXT_FILE_ENCODING = "utf-8";

export const TEXT_FILE_REQUEST_OPTIONS = {
  cache: "no-store",
  redirect: "error",
} as const satisfies Pick<RequestInit, "cache" | "redirect">;

export const TEXT_FILE_ERROR_CODE = {
  TOO_LARGE: "TEXT_FILE_TOO_LARGE",
  INVALID_ENCODING: "TEXT_FILE_INVALID_ENCODING",
  LOAD_FAILED: "TEXT_FILE_LOAD_FAILED",
} as const;
