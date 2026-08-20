export const DASHBOARD_LAYOUT = {
  DESKTOP_MIN_WIDTH_PX: 1024,
  MAX_WIDTH_PX: 1200,
  ROW_HEIGHT_PX: 48,
  GAP_PX: 12,
} as const;

export const DASHBOARD_MODE = {
  VIEW: "view",
  EDIT: "edit",
} as const;

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
  EDIT_STARTED: "edit-started",
  DRAFT_REPLACED: "draft-replaced",
  EDIT_CANCELLED: "edit-cancelled",
  SAVE_STARTED: "save-started",
  SAVE_SUCCEEDED: "save-succeeded",
  SAVE_FAILED: "save-failed",
  MESSAGE_SET: "message-set",
} as const;

export const UI_MESSAGES = {
  LOADING: "페이지를 불러오는 중…",
  LOAD_FAILED: "페이지 정보를 불러오지 못했습니다.",
  SAVE_COMPLETE: "위젯 배치를 저장했습니다.",
  SAVE_FAILED: "위젯 배치를 저장하지 못했습니다.",
  MAX_WIDGETS: "더 이상 위젯을 추가할 수 없습니다.",
  NO_AVAILABLE_POSITION: "위젯을 놓을 빈 공간이 없습니다.",
  EMPTY_BOARD: "아직 추가한 위젯이 없습니다.",
  EMPTY_BOARD_HELP: "꾸미기 모드에서 빈 위젯을 추가해 보세요.",
  MOBILE_EDIT_NOTICE: `위젯 편집은 ${DASHBOARD_LAYOUT.DESKTOP_MIN_WIDTH_PX}px 이상의 화면에서 사용할 수 있습니다.`,
  UNSAVED_CHANGES: "저장하지 않은 위젯 배치가 있습니다.",
} as const;

export const DESKTOP_MEDIA_QUERY = `(min-width: ${DASHBOARD_LAYOUT.DESKTOP_MIN_WIDTH_PX}px)`;
