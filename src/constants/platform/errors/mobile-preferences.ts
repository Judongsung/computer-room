import { HTTP_STATUS } from "@/constants/platform/http";
import type { AppErrorDefinition } from "@/types/platform/error";

export const MOBILE_PREFERENCES_ERRORS = {
  WALLPAPER_FILE_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "WALLPAPER_FILE_NOT_FOUND",
    message: "배경화면으로 사용할 이미지 파일을 찾을 수 없습니다.",
  },
  WALLPAPER_FILE_TYPE_NOT_SUPPORTED: {
    status: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
    code: "WALLPAPER_FILE_TYPE_NOT_SUPPORTED",
    message: "이미지 파일만 배경화면으로 사용할 수 있습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
