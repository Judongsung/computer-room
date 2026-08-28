import { HTTP_STATUS } from "@/constants/platform/http";
import type { AppErrorDefinition } from "@/types/platform/error";

export const IMAGE_UPLOAD_ERRORS = {
  UNSUPPORTED_IMAGE_TYPE: {
    status: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
    code: "IMAGE_UPLOAD_UNSUPPORTED_IMAGE_TYPE",
    message: "이 프로필에서 허용하지 않는 이미지 형식입니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
