import type { AppErrorDefinition } from "@/types/platform/error";
import { HTTP_STATUS } from "@/constants/platform/http";

export const MEMO_ERRORS = {
  INVALID_CONTENT: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_MEMO_CONTENT",
    message: "메모 내용이 올바르지 않습니다.",
  },
  INVALID_VERSION: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_MEMO_VERSION",
    message: "메모 버전이 올바르지 않습니다.",
  },
  VERSION_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "MEMO_VERSION_NOT_FOUND",
    message: "메모 버전을 찾을 수 없습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
