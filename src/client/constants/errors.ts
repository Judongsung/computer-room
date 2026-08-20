import type { ErrorDefinition } from "../../types/error";

export const CLIENT_ERRORS = {
  REQUEST_FAILED: {
    code: "REQUEST_FAILED",
    message: "요청을 처리하지 못했습니다.",
  },
  INVALID_RESPONSE: {
    code: "INVALID_RESPONSE",
    message: "서버 응답 형식이 올바르지 않습니다.",
  },
} as const satisfies Record<string, ErrorDefinition>;
