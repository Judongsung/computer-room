import type { AppErrorDefinition } from "@/types/platform/error";
import { HTTP_STATUS } from "@/constants/platform/http";

export const STORAGE_STATUS_ERRORS = {
  LOAD_FAILED: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "STORAGE_STATUS_LOAD_FAILED",
    message: "저장소 상태를 불러오지 못했습니다.",
  },
  INVALID_USAGE: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "INVALID_STORAGE_USAGE",
    message: "저장소 사용량 정보가 올바르지 않습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;

export const STORAGE_STATUS_LOG_MESSAGES = {
  LOAD_FAILED: "Storage status measurement failed",
} as const;
