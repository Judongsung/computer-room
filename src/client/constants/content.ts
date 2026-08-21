export const SITE_COPY = {
  TITLE: "computer-room",
  TAGLINE: "나만의 위젯 홈페이지",
  LOGOUT: "로그아웃",
} as const;

export const DASHBOARD_COPY = {
  TITLE: "홈",
  DESCRIPTION: "원하는 기능을 위젯으로 배치하는 개인 공간입니다.",
  RETRY: "다시 시도",
  EDIT: "꾸미기",
  ADD_MEMO_WIDGET: "메모 추가",
  ADD_CHECKLIST_WIDGET: "일일 체크리스트 추가",
  SAVE: "저장",
  SAVING: "저장 중…",
  CANCEL: "취소",
  EDIT_TOOLS_LABEL: "위젯 편집 도구",
} as const;

export const WIDGET_COPY = {
  DELETE_CONFIRM: "이 위젯의 내용과 로그가 모두 삭제됩니다. 위젯을 제거할까요?",
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
  DELETE_LABEL: "메모 위젯 삭제",
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
  DELETE_LABEL: "일일 체크리스트 위젯 삭제",
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
