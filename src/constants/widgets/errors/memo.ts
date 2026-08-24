import type { AppErrorDefinition } from "@/types/platform/error";
import { HTTP_STATUS } from "@/constants/platform/http";

export const MEMO_ERRORS = {
  INVALID_CONTENT: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_MEMO_CONTENT",
    message: "메모 내용이 올바르지 않습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
