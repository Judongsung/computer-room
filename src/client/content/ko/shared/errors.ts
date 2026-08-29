import { CLIENT_ERROR_CODE } from "@client/constants/shared/errors";

export const CLIENT_ERROR_MESSAGE = {
  [CLIENT_ERROR_CODE.REQUEST_FAILED]: "요청을 처리하지 못했습니다.",
  [CLIENT_ERROR_CODE.INVALID_RESPONSE]: "서버 응답 형식이 올바르지 않습니다.",
} as const;
