export const XP_CONTEXT_MENU_ITEM_KIND = {
  COMMAND: "command",
  SEPARATOR: "separator",
} as const;

export const XP_CONTEXT_MENU_CLASS_NAME = {
  ROOT: "xp-context-menu",
  ITEM: "xp-context-menu__item",
  RADIO_ITEM: "xp-context-menu__item--radio",
  CHECK: "xp-context-menu__check",
  SEPARATOR: "xp-context-menu__separator",
  ERROR: "xp-context-menu__error",
} as const;

export const XP_CONTEXT_MENU_COMMAND_ID = {
  OPEN: "open",
  OPEN_NEW_WINDOW: "open-new-window",
  OPEN_NEW_TAB: "open-new-tab",
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
  ADD_IMAGE_UPLOAD_PROFILES: "add-image-upload-profiles",
  ADD_ADMIN: "add-admin",
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
