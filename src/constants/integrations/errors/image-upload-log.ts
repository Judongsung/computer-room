import { HTTP_STATUS } from "@/constants/platform/http";
import type { AppErrorDefinition } from "@/types/platform/error";

export const IMAGE_UPLOAD_LOG_ERRORS = {
  INVALID_STORED_LOG: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "IMAGE_UPLOAD_LOG_INVALID_STORED_LOG",
    message: "이미지 수신 기록을 읽지 못했습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
