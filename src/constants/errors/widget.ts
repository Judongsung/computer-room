import { HTTP_STATUS } from "../http";
import type { AppErrorDefinition } from "../../types/error";
import { MAX_OPEN_WIDGET_COUNT } from "../widget";

export const WIDGET_ERRORS = {
  INVALID_LAYOUT: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_WIDGET_LAYOUT",
    message: "위젯 배치 정보가 올바르지 않습니다.",
  },
  TOO_MANY_WIDGETS: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "TOO_MANY_WIDGETS",
    message: `위젯 창은 최대 ${MAX_OPEN_WIDGET_COUNT}개까지 열 수 있습니다.`,
  },
  DUPLICATE_WIDGET_ID: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "DUPLICATE_WIDGET_ID",
    message: "중복된 위젯 ID가 있습니다.",
  },
  DUPLICATE_STACK_ORDER: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "DUPLICATE_WIDGET_STACK_ORDER",
    message: "중복된 위젯 창 순서가 있습니다.",
  },
  INVALID_STORED_WIDGET: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "INVALID_STORED_WIDGET",
    message: "저장된 위젯 정보가 올바르지 않습니다.",
  },
  WIDGET_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "WIDGET_NOT_FOUND",
    message: "위젯을 찾을 수 없습니다.",
  },
  WIDGET_TYPE_MISMATCH: {
    status: HTTP_STATUS.CONFLICT,
    code: "WIDGET_TYPE_MISMATCH",
    message: "요청한 기능과 위젯 종류가 일치하지 않습니다.",
  },
  WIDGET_TYPE_CHANGE_NOT_ALLOWED: {
    status: HTTP_STATUS.CONFLICT,
    code: "WIDGET_TYPE_CHANGE_NOT_ALLOWED",
    message: "기존 위젯의 종류는 변경할 수 없습니다.",
  },
  WIDGET_ALREADY_SAVED: {
    status: HTTP_STATUS.CONFLICT,
    code: "WIDGET_ALREADY_SAVED",
    message: "이미 파일로 저장된 위젯입니다.",
  },
  SAVED_WIDGET_DELETE_NOT_ALLOWED: {
    status: HTTP_STATUS.CONFLICT,
    code: "SAVED_WIDGET_DELETE_NOT_ALLOWED",
    message: "저장된 위젯은 파일을 휴지통으로 이동해 삭제해 주세요.",
  },
  WIDGET_NOT_OPEN: {
    status: HTTP_STATUS.CONFLICT,
    code: "WIDGET_NOT_OPEN",
    message: "열려 있지 않은 위젯입니다.",
  },
  UNSAVED_WIDGET_CLOSE_NOT_ALLOWED: {
    status: HTTP_STATUS.CONFLICT,
    code: "UNSAVED_WIDGET_CLOSE_NOT_ALLOWED",
    message: "저장하지 않은 위젯은 저장하거나 폐기해야 합니다.",
  },
} as const satisfies Record<string, AppErrorDefinition>;
