import { HTTP_STATUS } from "../http";
import type { AppErrorDefinition } from "../../types/error";

export const NOVELAI_ERRORS = {
  UNSUPPORTED_IMAGE_TYPE: {
    status: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
    code: "NOVELAI_UNSUPPORTED_IMAGE_TYPE",
    message: "지원하지 않는 이미지 형식입니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
