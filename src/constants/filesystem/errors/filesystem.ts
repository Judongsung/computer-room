import { MAX_FILE_NAME_BYTES } from "@/constants/filesystem/file";
import { HTTP_STATUS } from "@/constants/platform/http";
import type { AppErrorDefinition } from "@/types/platform/error";

export const FILESYSTEM_ERRORS = {
  DELETION_STARTED: {
    status: HTTP_STATUS.CONFLICT,
    code: "FILESYSTEM_DELETION_STARTED",
    message: "영구 삭제를 시작한 항목은 복원할 수 없습니다. 삭제를 다시 시도해 주세요.",
  },
  ENTRY_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "FILESYSTEM_ENTRY_NOT_FOUND",
    message: "파일 또는 폴더를 찾을 수 없습니다.",
  },
  DIRECTORY_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "FILESYSTEM_DIRECTORY_NOT_FOUND",
    message: "폴더를 찾을 수 없습니다.",
  },
  DIRECTORY_PATH_CONFLICT: {
    status: HTTP_STATUS.CONFLICT,
    code: "FILESYSTEM_DIRECTORY_PATH_CONFLICT",
    message: "지정된 경로에 폴더가 아닌 항목이 있습니다.",
  },
  INVALID_ENTRY_NAME: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_FILESYSTEM_ENTRY_NAME",
    message: "파일 또는 폴더 이름이 올바르지 않습니다.",
  },
  ENTRY_NAME_TOO_LONG: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "FILESYSTEM_ENTRY_NAME_TOO_LONG",
    message: `이름은 UTF-8 기준 ${MAX_FILE_NAME_BYTES}바이트 이하여야 합니다.`,
  },
  INVALID_PARENT: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_FILESYSTEM_PARENT",
    message: "이동할 폴더가 올바르지 않습니다.",
  },
  DIRECTORY_CYCLE: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "FILESYSTEM_DIRECTORY_CYCLE",
    message: "폴더를 자기 자신이나 하위 폴더로 이동할 수 없습니다.",
  },
  SYSTEM_ENTRY_PROTECTED: {
    status: HTTP_STATUS.FORBIDDEN,
    code: "FILESYSTEM_SYSTEM_ENTRY_PROTECTED",
    message: "시스템 폴더는 변경하거나 삭제할 수 없습니다.",
  },
  ENTRY_NOT_ACTIVE: {
    status: HTTP_STATUS.CONFLICT,
    code: "FILESYSTEM_ENTRY_NOT_ACTIVE",
    message: "바탕 화면 또는 내 문서에 있는 항목만 변경할 수 있습니다.",
  },
  ENTRY_NOT_TRASHED: {
    status: HTTP_STATUS.CONFLICT,
    code: "FILESYSTEM_ENTRY_NOT_TRASHED",
    message: "휴지통에 있는 항목이 아닙니다.",
  },
  INVALID_STORED_ENTRY: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "INVALID_STORED_FILESYSTEM_ENTRY",
    message: "저장된 파일 시스템 정보가 올바르지 않습니다.",
  },
  INVALID_DESKTOP_PLACEMENT: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_DESKTOP_PLACEMENT",
    message: "바탕 화면 아이콘 배치 정보가 올바르지 않습니다.",
  },
  INVALID_DIRECTORY_SORT: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_FILESYSTEM_DIRECTORY_SORT",
    message: "폴더 정렬 설정이 올바르지 않습니다.",
  },
  INVALID_STORED_DIRECTORY_SORT: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "INVALID_STORED_FILESYSTEM_DIRECTORY_SORT",
    message: "저장된 폴더 정렬 설정이 올바르지 않습니다.",
  },
  DESKTOP_FULL: {
    status: HTTP_STATUS.CONFLICT,
    code: "DESKTOP_FULL",
    message: "바탕 화면에 빈 공간이 없습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
