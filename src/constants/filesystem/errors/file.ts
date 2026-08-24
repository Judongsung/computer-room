import { MAX_FILE_SIZE_BYTES } from "@/constants/filesystem/file";
import { HTTP_STATUS } from "@/constants/platform/http";
import type { AppErrorDefinition } from "@/types/platform/error";

const MAX_FILE_SIZE_MEGABYTES = MAX_FILE_SIZE_BYTES / 1_000_000;

export const FILE_ERRORS = {
  MISSING_FILE_BODY: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "MISSING_FILE_BODY",
    message: "업로드할 파일 본문이 없습니다.",
  },
  FILE_SIZE_MISMATCH: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "FILE_SIZE_MISMATCH",
    message: "전송된 파일 크기가 요청 정보와 일치하지 않습니다.",
  },
  FILE_CONTENT_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "FILE_CONTENT_NOT_FOUND",
    message: "파일 본문을 찾을 수 없습니다.",
  },
  FILE_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "FILE_NOT_FOUND",
    message: "파일을 찾을 수 없습니다.",
  },
  INVALID_FILE_SIZE: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_FILE_SIZE",
    message: "올바른 파일 크기가 필요합니다.",
  },
  FILE_TOO_LARGE: {
    status: HTTP_STATUS.CONTENT_TOO_LARGE,
    code: "FILE_TOO_LARGE",
    message: `파일당 최대 크기는 ${MAX_FILE_SIZE_MEGABYTES}MB입니다.`,
  },
  INVALID_CONTENT_TYPE: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_CONTENT_TYPE",
    message: "올바르지 않은 파일 형식입니다.",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
    code: "UNSUPPORTED_MEDIA_TYPE",
    message: "이 파일 형식은 미디어 뷰어에서 지원하지 않습니다.",
  },
  RANGE_NOT_SATISFIABLE: {
    status: HTTP_STATUS.RANGE_NOT_SATISFIABLE,
    code: "RANGE_NOT_SATISFIABLE",
    message: "요청한 파일 범위를 읽을 수 없습니다.",
  },
  STORAGE_WRITE_FAILED: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "FILE_STORAGE_WRITE_FAILED",
    message: "파일을 저장하지 못했습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
