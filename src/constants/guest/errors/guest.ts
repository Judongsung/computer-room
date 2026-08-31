import { HTTP_STATUS } from "@/constants/platform/http";
import type { AppErrorDefinition } from "@/types/platform/error";

export const GUEST_ERRORS = {
  RESOURCE_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "GUEST_RESOURCE_NOT_FOUND",
    message: "공개된 항목을 찾을 수 없습니다.",
  },
  RATE_LIMITED: {
    status: HTTP_STATUS.TOO_MANY_REQUESTS,
    code: "GUEST_RATE_LIMITED",
    message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  },
  RATE_LIMIT_UNAVAILABLE: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "GUEST_RATE_LIMIT_UNAVAILABLE",
    message: "게스트 요청을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
