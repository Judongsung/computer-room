import { HTTP_STATUS } from "@/constants/platform/http";
import type { AppErrorDefinition } from "@/types/platform/error";

export const THUMBNAIL_ERRORS = {
  UNSUPPORTED_SOURCE: {
    status: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
    code: "THUMBNAIL_UNSUPPORTED_SOURCE",
    message: "썸네일을 만들 수 없는 이미지 형식입니다.",
  },
  SOURCE_TOO_LARGE: {
    status: HTTP_STATUS.CONTENT_TOO_LARGE,
    code: "THUMBNAIL_SOURCE_TOO_LARGE",
    message: "썸네일을 만들기에는 이미지가 너무 큽니다.",
  },
  GENERATION_FAILED: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "THUMBNAIL_GENERATION_FAILED",
    message: "썸네일을 생성하지 못했습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
