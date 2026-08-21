export const LOAD_STATUS = {
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
} as const;

export const MESSAGE_KIND = {
  INFO: "info",
  SUCCESS: "success",
  ERROR: "error",
} as const;

export const DASHBOARD_ACTION_TYPE = {
  LOAD_STARTED: "load-started",
  LOAD_SUCCEEDED: "load-succeeded",
  LOAD_FAILED: "load-failed",
  WIDGETS_REPLACED: "widgets-replaced",
  MESSAGE_SET: "message-set",
} as const;

export const UI_MESSAGES = {
  LOADING: "페이지를 불러오는 중…",
  LOAD_FAILED: "페이지 정보를 불러오지 못했습니다.",
  SAVE_FAILED: "위젯 배치를 저장하지 못했습니다.",
  MAX_WIDGETS: "더 이상 위젯을 추가할 수 없습니다.",
  UNSAVED_CHANGES: "저장되지 않은 위젯 배치 변경이 있습니다.",
} as const;
