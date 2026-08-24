import type { AppErrorDefinition } from "@/types/platform/error";
import {
  CHECKLIST_ITEM_LABEL_MAX_LENGTH,
  MAX_ACTIVE_CHECKLIST_ITEMS,
} from "@/constants/widgets/checklist";
import { HTTP_STATUS } from "@/constants/platform/http";

export const CHECKLIST_ERRORS = {
  INVALID_LABEL: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_CHECKLIST_LABEL",
    message: `체크 항목은 1자 이상 ${CHECKLIST_ITEM_LABEL_MAX_LENGTH}자 이하로 입력해 주세요.`,
  },
  TOO_MANY_ITEMS: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "TOO_MANY_CHECKLIST_ITEMS",
    message: `체크 항목은 위젯당 최대 ${MAX_ACTIVE_CHECKLIST_ITEMS}개까지 추가할 수 있습니다.`,
  },
  ITEM_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "CHECKLIST_ITEM_NOT_FOUND",
    message: "체크 항목을 찾을 수 없습니다.",
  },
  INVALID_CHECK_STATE: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_CHECK_STATE",
    message: "체크 상태가 올바르지 않습니다.",
  },
  INVALID_STORED_EVENT: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "INVALID_STORED_CHECKLIST_EVENT",
    message: "저장된 체크리스트 로그가 올바르지 않습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
