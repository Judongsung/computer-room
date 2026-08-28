import { HTTP_STATUS } from "@/constants/platform/http";
import type { AppErrorDefinition } from "@/types/platform/error";

export const IMAGE_UPLOAD_PROFILE_ERRORS = {
  NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "IMAGE_UPLOAD_PROFILE_NOT_FOUND",
    message: "이미지 업로드 프로필을 찾을 수 없습니다.",
  },
  ID_ALREADY_EXISTS: {
    status: HTTP_STATUS.CONFLICT,
    code: "IMAGE_UPLOAD_PROFILE_ID_ALREADY_EXISTS",
    message: "같은 ID의 이미지 업로드 프로필이 이미 있습니다.",
  },
  INVALID_ID: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_IMAGE_UPLOAD_PROFILE_ID",
    message: "프로필 ID 형식이 올바르지 않습니다.",
  },
  INVALID_DISPLAY_NAME: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_IMAGE_UPLOAD_PROFILE_DISPLAY_NAME",
    message: "프로필 표시 이름이 올바르지 않습니다.",
  },
  INVALID_ROOT: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_IMAGE_UPLOAD_PROFILE_ROOT",
    message: "프로필 기준 폴더가 올바르지 않습니다.",
  },
  INVALID_PATH_TEMPLATE: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_IMAGE_UPLOAD_PROFILE_PATH_TEMPLATE",
    message: "프로필 경로 템플릿이 올바르지 않습니다.",
  },
  INVALID_FILE_NAME_TEMPLATE: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_IMAGE_UPLOAD_PROFILE_FILE_NAME_TEMPLATE",
    message: "프로필 파일명 템플릿이 올바르지 않습니다.",
  },
  INVALID_CONTENT_TYPES: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_IMAGE_UPLOAD_PROFILE_CONTENT_TYPES",
    message: "허용 이미지 형식을 하나 이상 선택해야 합니다.",
  },
  INVALID_STORED_PROFILE: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "INVALID_STORED_IMAGE_UPLOAD_PROFILE",
    message: "저장된 이미지 업로드 프로필이 올바르지 않습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
