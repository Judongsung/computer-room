import { HTTP_STATUS } from "../http";
import type { AppErrorDefinition } from "../../types/error";

export const AUTH_ERRORS = {
  AUTHENTICATION_REQUIRED: {
    status: HTTP_STATUS.UNAUTHORIZED,
    code: "AUTHENTICATION_REQUIRED",
    message: "로그인이 필요합니다.",
  },
  EMAIL_CLAIM_REQUIRED: {
    status: HTTP_STATUS.FORBIDDEN,
    code: "EMAIL_CLAIM_REQUIRED",
    message: "계정 이메일을 확인할 수 없습니다.",
  },
  OWNER_ONLY: {
    status: HTTP_STATUS.FORBIDDEN,
    code: "OWNER_ONLY",
    message: "이 계정은 접근할 수 없습니다.",
  },
  INVALID_ACCESS_TOKEN: {
    status: HTTP_STATUS.UNAUTHORIZED,
    code: "INVALID_ACCESS_TOKEN",
    message: "로그인 정보를 확인할 수 없습니다.",
  },
  LOCAL_AUTH_ONLY: {
    status: HTTP_STATUS.FORBIDDEN,
    code: "LOCAL_AUTH_ONLY",
    message: "로컬 인증 우회는 localhost에서만 허용됩니다.",
  },
  AUTH_CONFIGURATION_ERROR: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "AUTH_CONFIGURATION_ERROR",
    message: "서버 인증 설정이 완료되지 않았습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
