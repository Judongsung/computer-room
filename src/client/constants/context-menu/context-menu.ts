export const XP_CONTEXT_MENU_ITEM_KIND = {
  COMMAND: "command",
  SEPARATOR: "separator",
} as const;

export const XP_CONTEXT_MENU_CLASS_NAME = {
  ROOT: "xp-context-menu",
  ITEM: "xp-context-menu__item",
  SEPARATOR: "xp-context-menu__separator",
  ERROR: "xp-context-menu__error",
} as const;

export const XP_CONTEXT_MENU_COPY = {
  LABEL: "바로 가기 메뉴",
  OPEN: "열기",
  OPEN_NEW_WINDOW: "새 창에서 열기",
  COPY_ADDRESS: "주소 복사",
  CUT: "잘라내기",
  COPY: "복사",
  PASTE: "붙여넣기",
  DELETE: "삭제",
  SELECT_ALL: "전체 선택",
  REFRESH_PAGE: "페이지 새로고침",
  STORAGE_STATUS: "저장소 상태 열기",
  CLIPBOARD_FAILED: "클립보드 작업을 완료하지 못했습니다.",
  COMMAND_FAILED: "메뉴 명령을 완료하지 못했습니다.",
} as const;

export const XP_CONTEXT_MENU_COMMAND_ID = {
  OPEN: "open",
  OPEN_NEW_WINDOW: "open-new-window",
  COPY_ADDRESS: "copy-address",
  CUT: "cut",
  COPY: "copy",
  PASTE: "paste",
  DELETE: "delete",
  SELECT_ALL: "select-all",
  REFRESH_PAGE: "refresh-page",
  STORAGE_STATUS: "storage-status",
  RESTORE: "restore",
  MINIMIZE: "minimize",
  MAXIMIZE: "maximize",
  CLOSE: "close",
  NEW_FOLDER: "new-folder",
  ADD_MEMO: "add-memo",
  ADD_CHECKLIST: "add-checklist",
  ADD_STORAGE_STATUS: "add-storage-status",
  REFRESH: "refresh",
  DOWNLOAD: "download",
  RENAME: "rename",
  MOVE: "move",
  TRASH: "trash",
  RESTORE_FILES: "restore-files",
  PERMANENT_DELETE: "permanent-delete",
  EMPTY_RECYCLE_BIN: "empty-recycle-bin",
  UPLOAD_FILES: "upload-files",
  UPLOAD_FOLDER: "upload-folder",
  PROPERTIES: "properties",
} as const;

export const XP_CONTEXT_MENU_LAYOUT = {
  WIDTH_PX: 224,
  VIEWPORT_MARGIN_PX: 4,
  ERROR_DURATION_MS: 4_000,
} as const;

export const XP_CONTEXT_MENU_EDITABLE_SELECTOR =
  "input:not([type]), input[type='text'], input[type='search'], input[type='email'], input[type='url'], input[type='tel'], input[type='password'], textarea, [contenteditable='true']";
