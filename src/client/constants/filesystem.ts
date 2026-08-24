export const FILESYSTEM_COPY = {
  DESKTOP_SHORTCUTS: "바탕 화면 바로가기",
  FILE_TOOLBAR: "파일 및 폴더 작업",
  RECYCLE_BIN_TOOLBAR: "휴지통 작업",
  WIDGET_TOOLBAR: "위젯 작업",
  OPEN: "열기",
  REFRESH: "새로 고침",
  BACK: "뒤로",
  UP: "위로",
  NEW_FOLDER: "새 폴더",
  UPLOAD: "업로드",
  UPLOAD_FILES: "파일 업로드",
  UPLOAD_FOLDER: "폴더 업로드",
  DOWNLOAD: "다운로드",
  RENAME: "이름 변경",
  MOVE: "이동",
  DELETE: "삭제",
  ADDRESS: "주소",
  NAME: "이름",
  TYPE: "종류",
  SIZE: "크기",
  DELETED_AT: "삭제한 날짜",
  ORIGINAL_LOCATION: "원래 위치",
  EMPTY_DIRECTORY: "이 폴더는 비어 있습니다.",
  EMPTY_TRASH: "휴지통이 비어 있습니다.",
  LOAD_FAILED: "파일 목록을 불러오지 못했습니다.",
  CHANGE_FAILED: "파일 작업을 완료하지 못했습니다.",
  LOAD_MORE: "더 보기",
  SELECTED: "1개 항목 선택됨",
  SELECTED_COUNT: (count: number) => `${count}개 항목 선택됨`,
  ITEM_COUNT_SUFFIX: "개 항목",
  FOLDER: "파일 폴더",
  FILE: "파일",
  CREATE_FOLDER_TITLE: "새 폴더 만들기",
  RENAME_TITLE: "이름 변경",
  MOVE_TITLE: "항목 이동",
  FOLDER_NAME: "폴더 이름",
  ENTRY_NAME: "새 이름",
  MOVE_HERE: "여기로 이동",
  CANCEL: "취소",
  CONFIRM: "확인",
  RESTORE: "복원",
  PERMANENT_DELETE: "영구 삭제",
  EMPTY_RECYCLE_BIN: "휴지통 비우기",
  PERMANENT_DELETE_CONFIRM: "선택한 항목을 영구적으로 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
  EMPTY_RECYCLE_BIN_CONFIRM: "휴지통의 모든 항목을 영구적으로 삭제할까요?",
  MY_COMPUTER_DESCRIPTION: "사용할 위젯을 선택하면 바탕 화면에 새 창이 생성됩니다.",
  RUN_WIDGET: "위젯 실행",
  BUSY: "처리 중…",
  TRANSFER_TITLE: "파일 전송",
  TRANSFER_PROGRESS: "항목을 전송하는 중입니다.",
  TRANSFER_COMPLETE: "파일 전송이 완료되었습니다.",
  TRANSFER_PARTIAL: "일부 항목을 전송하지 못했습니다.",
  TRANSFER_FAILED: "파일 전송에 실패했습니다.",
  TRANSFER_FAILURE_ITEM: "실패",
  TRANSFER_SKIPPED_ITEM: "건너뜀",
  FOLDER_DROP_UNSUPPORTED:
    "이 브라우저에서는 폴더 드롭을 지원하지 않아 파일만 업로드했습니다.",
  DROP_NOT_ALLOWED: "이 위치에는 항목을 놓을 수 없습니다.",
  DESKTOP_OVERFLOW: (count: number) =>
    `현재 화면에 표시하지 못한 바탕 화면 항목이 ${count}개 있습니다.`,
  OPEN_DESKTOP: "바탕 화면 열기",
  CLOSE: "닫기",
  BATCH_RESULT_TITLE: "파일 작업 결과",
  BATCH_PARTIAL: "일부 항목을 처리하지 못했습니다.",
  BATCH_SUCCESS_COUNT: (count: number) => `${count}개 항목 처리 완료`,
  DOWNLOAD_TITLE: "파일 다운로드",
  DOWNLOAD_PREPARING: "다운로드할 항목을 확인하는 중입니다.",
  DOWNLOAD_PROGRESS: (completed: number, total: number) =>
    `${total}개 중 ${completed}개 파일을 저장하는 중입니다.`,
  DOWNLOAD_BYTE_PROGRESS: (transferred: string, total: string) =>
    `${transferred} / ${total}`,
  DOWNLOAD_UNSUPPORTED:
    "이 브라우저는 디스크 스트리밍 다운로드를 지원하지 않습니다. 최신 Edge 또는 Chrome을 사용해 주세요.",
  DOWNLOAD_EMPTY: "다운로드할 일반 파일이나 폴더가 없습니다.",
  DOWNLOAD_FAILED:
    "ZIP 파일을 저장하지 못했습니다. 다운로드를 다시 시도해 주세요.",
  DOWNLOAD_FILE_FAILED: (path: string) =>
    `${path} 파일을 가져오지 못했습니다. 다운로드를 다시 시도해 주세요.`,
  DOWNLOAD_CANCEL: "다운로드 취소",
  DOWNLOAD_SKIPPED_WIDGETS: (count: number) =>
    `위젯 파일 ${count}개는 ZIP에서 제외했습니다.`,
  CONTEXT_MENU: "바탕 화면 항목 메뉴",
  WIDGET: "위젯 파일",
  SAVE_WIDGET_TITLE: "위젯 파일로 저장",
  SAVE_LOCATION: "저장 위치",
  FILE_NAME: "파일 이름",
  SAVE_HERE: "저장",
  UNSAVED_CLOSE_TITLE: "저장하지 않은 위젯",
  UNSAVED_CLOSE_MESSAGE: "이 위젯을 파일로 저장하시겠습니까?",
  SAVE: "저장",
  DONT_SAVE: "저장 안 함",
  BYTE_UNIT: "B",
  KILOBYTE_UNIT: "KB",
  MEGABYTE_UNIT: "MB",
  GIGABYTE_UNIT: "GB",
  TERABYTE_UNIT: "TB",
} as const;

export const FILESYSTEM_UPLOAD_POLICY = {
  CONCURRENCY: 3,
} as const;

export const FILESYSTEM_DRAG_SOURCE = {
  ACTIVE: "active",
  TRASH: "trash",
} as const;

export const FILE_PICKER_ABORT_ERROR_NAME = "AbortError";

export const FILESYSTEM_SELECTION_DATA_ATTRIBUTE =
  "data-filesystem-selection-id";
export const FILESYSTEM_SELECTION_SELECTOR =
  `[${FILESYSTEM_SELECTION_DATA_ATTRIBUTE}]`;

export const FILESYSTEM_SELECTION_POLICY = {
  AUTO_SCROLL_EDGE_PX: 28,
  AUTO_SCROLL_STEP_PX: 18,
} as const;

export const EXPLORER_WINDOW_ID_PREFIX = "explorer-window-";

export const DESKTOP_ENTRY_UNORDERED_INDEX = Number.MAX_SAFE_INTEGER;

export const FILE_SIZE_DISPLAY = {
  KILOBYTE_BYTES: 1_000,
  MEGABYTE_BYTES: 1_000_000,
  GIGABYTE_BYTES: 1_000_000_000,
  TERABYTE_BYTES: 1_000_000_000_000,
  FRACTION_DIGITS: 1,
} as const;
