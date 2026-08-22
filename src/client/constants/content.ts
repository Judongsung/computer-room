import { WIDGET_TYPE } from "../../constants/widget";
import { LAYOUT_SAVE_STATUS } from "./layout-save";

export const SITE_COPY = {
  TITLE: "computer-room",
} as const;

export const DASHBOARD_COPY = {
  RETRY: "다시 시도",
  CONFIRM: "확인",
  START: "시작",
  START_MENU: "시작 메뉴",
  ADD_MEMO_WIDGET: "새 메모",
  ADD_CHECKLIST_WIDGET: "새 일일 체크리스트",
  PROGRAMS: "위젯",
  PERSONAL_SPACE: "개인 공간",
  ACCESS_PROTECTED: "Cloudflare Access로 보호됨",
  POWER: "로그아웃",
  POWER_DESCRIPTION: "Cloudflare Access 세션 종료",
  SAVE_PENDING: "저장 대기 중",
  SAVING: "저장 중…",
  SAVE_COMPLETE: "저장됨",
  SAVE_FAILED: "저장 실패",
  CLOSE_DISABLED: "위젯 닫기는 다음 버전에서 지원합니다.",
  MINIMIZE: "최소화",
  MAXIMIZE: "최대화",
  RESTORE: "이전 크기로",
  CLOSE: "닫기",
  EMPTY_DESKTOP: "시작 메뉴에서 위젯을 추가하세요.",
  DESKTOP: "computer-room 바탕 화면",
  TASKBAR: "작업 표시줄",
} as const;

export const MEMO_WIDGET_COPY = {
  TITLE: "메모",
  EDIT: "편집",
  WRITE: "작성",
  PREVIEW: "미리보기",
  TABS_LABEL: "메모 편집 보기",
  SAVE: "저장",
  SAVING: "저장 중…",
  CANCEL: "취소",
  EMPTY_CONTENT: "작성된 메모가 없습니다.",
  EDITOR_LABEL: "마크다운 메모 내용",
  SAVE_FAILED: "메모를 저장하지 못했습니다.",
} as const;

export const CHECKLIST_WIDGET_COPY = {
  TITLE: "일일 체크리스트",
  DETAILS: "상세보기",
  EDIT: "편집",
  FINISH_EDITING: "완료",
  EMPTY_CONTENT: "아직 체크 항목이 없습니다.",
  NEW_ITEM_PLACEHOLDER: "새 체크 항목",
  ADD_ITEM: "추가",
  EDIT_ITEM: "수정",
  SAVE_ITEM: "저장",
  CANCEL_ITEM: "취소",
  DELETE_ITEM: "삭제",
  DELETE_ITEM_CONFIRM: "이 항목을 삭제할까요? 과거 로그는 유지됩니다.",
  LOAD_FAILED: "체크리스트를 불러오지 못했습니다.",
  CHANGE_FAILED: "체크리스트를 변경하지 못했습니다.",
  LOG_TITLE: "체크리스트 로그",
  LOG_LOADING: "로그를 불러오는 중…",
  LOG_EMPTY: "아직 기록이 없습니다.",
  LOG_LOAD_FAILED: "체크리스트 로그를 불러오지 못했습니다.",
  LOAD_MORE: "더 보기",
  CLOSE: "닫기",
  ADDED: "추가",
  RENAMED: "이름 변경",
  DELETED: "삭제",
  CHECKED: "체크",
  UNCHECKED: "체크 취소",
} as const;

export const WIDGET_TITLE_BY_TYPE = {
  [WIDGET_TYPE.MEMO]: MEMO_WIDGET_COPY.TITLE,
  [WIDGET_TYPE.DAILY_CHECKLIST]: CHECKLIST_WIDGET_COPY.TITLE,
} as const;

export const LAYOUT_SAVE_COPY_BY_STATUS = {
  [LAYOUT_SAVE_STATUS.IDLE]: "",
  [LAYOUT_SAVE_STATUS.PENDING]: DASHBOARD_COPY.SAVE_PENDING,
  [LAYOUT_SAVE_STATUS.SAVING]: DASHBOARD_COPY.SAVING,
  [LAYOUT_SAVE_STATUS.SAVED]: DASHBOARD_COPY.SAVE_COMPLETE,
  [LAYOUT_SAVE_STATUS.ERROR]: DASHBOARD_COPY.SAVE_FAILED,
} as const;
