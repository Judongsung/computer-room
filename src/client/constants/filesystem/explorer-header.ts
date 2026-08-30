import {
  FILESYSTEM_SORT_DIRECTION,
  FILESYSTEM_SORT_FIELD,
} from "@/constants/filesystem/sort";

export const XP_EXPLORER_HEADER_CLASS_NAME = {
  FRAME_TOOLBAR: "xp-window-frame__toolbar--explorer",
  ROOT: "xp-explorer-header",
  MENU_BAR: "xp-explorer-header__menu-bar",
  MENU_TRIGGER: "xp-explorer-header__menu-trigger",
  COMMAND_BAR: "xp-explorer-header__command-bar",
  COMMAND: "xp-explorer-header__command",
  COMMAND_ICON: "xp-explorer-header__command-icon",
  COMMAND_SEPARATOR: "xp-explorer-header__command-separator",
  ADDRESS_BAR: "xp-explorer-header__address-bar",
  ADDRESS_LABEL: "xp-explorer-header__address-label",
  ADDRESS_FIELD: "xp-explorer-header__address-field",
  ADDRESS_ICON: "xp-explorer-header__address-icon",
  ADDRESS_VALUE: "xp-explorer-header__address-value",
  BREADCRUMB: "xp-explorer-header__breadcrumb",
  BREADCRUMB_SEPARATOR: "xp-explorer-header__breadcrumb-separator",
} as const;
export const XP_EXPLORER_HEADER_LAYOUT = {
  MENU_BAR_HEIGHT_PX: 24,
  COMMAND_BAR_HEIGHT_PX: 40,
  ADDRESS_BAR_HEIGHT_PX: 30,
  COMMAND_ICON_SIZE_PX: 21,
  ADDRESS_ICON_SIZE_PX: 18,
} as const;

export const XP_EXPLORER_HEADER_CSS_VARIABLES = {
  "--xp-explorer-menu-bar-height": `${XP_EXPLORER_HEADER_LAYOUT.MENU_BAR_HEIGHT_PX}px`,
  "--xp-explorer-command-bar-height": `${XP_EXPLORER_HEADER_LAYOUT.COMMAND_BAR_HEIGHT_PX}px`,
  "--xp-explorer-address-bar-height": `${XP_EXPLORER_HEADER_LAYOUT.ADDRESS_BAR_HEIGHT_PX}px`,
  "--xp-explorer-command-icon-size": `${XP_EXPLORER_HEADER_LAYOUT.COMMAND_ICON_SIZE_PX}px`,
  "--xp-explorer-address-icon-size": `${XP_EXPLORER_HEADER_LAYOUT.ADDRESS_ICON_SIZE_PX}px`,
} as const;

export const XP_EXPLORER_MENU_ID = {
  FILE: "file",
  EDIT: "edit",
  VIEW: "view",
} as const;

export const XP_EXPLORER_MENU_ACCESS_KEY = {
  [XP_EXPLORER_MENU_ID.FILE]: "f",
  [XP_EXPLORER_MENU_ID.EDIT]: "e",
  [XP_EXPLORER_MENU_ID.VIEW]: "v",
} as const;

export const XP_EXPLORER_TOOLBAR_ACTION = {
  BACK: "back",
  UP: "up",
  NEW_FOLDER: "new-folder",
  UPLOAD_FILES: "upload-files",
  DOWNLOAD: "download",
  DELETE: "delete",
  RESTORE: "restore",
  PERMANENT_DELETE: "permanent-delete",
  EMPTY_RECYCLE_BIN: "empty-recycle-bin",
  RUN_WIDGET: "run-widget",
} as const;

export const XP_EXPLORER_SORT_FIELD_COMMAND_ID = {
  [FILESYSTEM_SORT_FIELD.NAME]: "sort-field-name",
  [FILESYSTEM_SORT_FIELD.CREATED_AT]: "sort-field-created-at",
  [FILESYSTEM_SORT_FIELD.UPDATED_AT]: "sort-field-updated-at",
  [FILESYSTEM_SORT_FIELD.TYPE]: "sort-field-type",
  [FILESYSTEM_SORT_FIELD.SIZE]: "sort-field-size",
} as const;

export const XP_EXPLORER_SORT_DIRECTION_COMMAND_ID = {
  [FILESYSTEM_SORT_DIRECTION.ASCENDING]: "sort-direction-ascending",
  [FILESYSTEM_SORT_DIRECTION.DESCENDING]: "sort-direction-descending",
} as const;
