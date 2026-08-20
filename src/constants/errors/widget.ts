import { HTTP_STATUS } from "../http";
import type { AppErrorDefinition } from "../../types/error";
import { MAX_WIDGET_COUNT } from "../widget";

export const WIDGET_ERRORS = {
  INVALID_LAYOUT: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_WIDGET_LAYOUT",
    message: "위젯 배치 정보가 올바르지 않습니다.",
  },
  TOO_MANY_WIDGETS: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "TOO_MANY_WIDGETS",
    message: `위젯은 최대 ${MAX_WIDGET_COUNT}개까지 추가할 수 있습니다.`,
  },
  DUPLICATE_WIDGET_ID: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "DUPLICATE_WIDGET_ID",
    message: "중복된 위젯 ID가 있습니다.",
  },
  WIDGET_COLLISION: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "WIDGET_COLLISION",
    message: "서로 겹치는 위젯이 있습니다.",
  },
  INVALID_STORED_WIDGET: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "INVALID_STORED_WIDGET",
    message: "저장된 위젯 정보가 올바르지 않습니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
