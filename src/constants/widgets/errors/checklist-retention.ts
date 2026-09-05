import { HTTP_STATUS } from "@/constants/platform/http";
import type { AppErrorDefinition } from "@/types/platform/error";

export const CHECKLIST_RETENTION_ERRORS = {
  INVALID_DAYS: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "CHECKLIST_INVALID_RETENTION_DAYS",
    message: "체크리스트 보관 기간이 올바르지 않습니다.",
  },
  INVALID_SETTINGS: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "CHECKLIST_INVALID_RETENTION_SETTINGS",
    message: "체크리스트 보관 설정을 읽지 못했습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
