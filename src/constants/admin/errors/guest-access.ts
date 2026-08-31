import { HTTP_STATUS } from "@/constants/platform/http";
import type { AppErrorDefinition } from "@/types/platform/error";

export const GUEST_ACCESS_ERRORS = {
  ENTRY_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "GUEST_PUBLICATION_ENTRY_NOT_FOUND",
    message: "공개 설정을 변경할 항목을 찾을 수 없습니다.",
  },
  ENTRY_NOT_ACTIVE: {
    status: HTTP_STATUS.CONFLICT,
    code: "GUEST_PUBLICATION_ENTRY_NOT_ACTIVE",
    message: "바탕 화면 또는 내 문서의 활성 항목만 공개할 수 있습니다.",
  },
  SYSTEM_ROOT_NOT_PUBLISHABLE: {
    status: HTTP_STATUS.FORBIDDEN,
    code: "GUEST_PUBLICATION_SYSTEM_ROOT_NOT_ALLOWED",
    message: "시스템 루트 폴더는 직접 공개할 수 없습니다.",
  },
  ENTRY_TYPE_NOT_SUPPORTED: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "GUEST_PUBLICATION_ENTRY_TYPE_NOT_SUPPORTED",
    message: "이 항목은 게스트에게 공개할 수 없습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
