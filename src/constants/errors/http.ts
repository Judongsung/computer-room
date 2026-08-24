import {
  CHECKLIST_LOG_PAGE_LIMIT,
  FILESYSTEM_PAGE_LIMIT,
  LEGACY_FILE_PAGE_LIMIT,
} from "../pagination";
import { HTTP_HEADERS, HTTP_MEDIA_TYPE, HTTP_STATUS } from "../http";
import type { AppErrorDefinition } from "../../types/error";

export const HTTP_ERRORS = {
  ROUTE_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "ROUTE_NOT_FOUND",
    message: "API 경로를 찾을 수 없습니다.",
  },
  INVALID_LIMIT: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_LIMIT",
    message: `limit은 1부터 ${Math.max(
      CHECKLIST_LOG_PAGE_LIMIT,
      LEGACY_FILE_PAGE_LIMIT,
    )}까지 가능합니다.`,
  },
  INVALID_FILESYSTEM_LIMIT: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_FILESYSTEM_LIMIT",
    message: `파일 시스템 limit은 1부터 ${FILESYSTEM_PAGE_LIMIT}까지 가능합니다.`,
  },
  CROSS_ORIGIN_REQUEST: {
    status: HTTP_STATUS.FORBIDDEN,
    code: "CROSS_ORIGIN_REQUEST",
    message: "다른 출처의 요청은 허용되지 않습니다.",
  },
  INVALID_QUERY: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_QUERY",
    message: "요청 매개변수 값이 올바르지 않습니다.",
  },
  INVALID_JSON: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_JSON",
    message: "JSON 요청 본문이 올바르지 않습니다.",
  },
  REQUEST_BODY_TOO_LARGE: {
    status: HTTP_STATUS.CONTENT_TOO_LARGE,
    code: "REQUEST_BODY_TOO_LARGE",
    message: "요청 본문의 크기가 너무 큽니다.",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
    code: "UNSUPPORTED_MEDIA_TYPE",
    message: `${HTTP_HEADERS.CONTENT_TYPE}은 ${HTTP_MEDIA_TYPE.JSON}이어야 합니다.`,
  },
  METHOD_NOT_ALLOWED: {
    status: HTTP_STATUS.METHOD_NOT_ALLOWED,
    code: "METHOD_NOT_ALLOWED",
    message: "허용되지 않은 요청 방식입니다.",
  },
  INTERNAL_ERROR: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "INTERNAL_ERROR",
    message: "요청을 처리하지 못했습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;

export const HTTP_LOG_MESSAGES = {
  UNHANDLED_API_ERROR: "Unhandled API error",
} as const;
