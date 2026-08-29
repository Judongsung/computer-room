import type { CSSProperties } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";

export const MOBILE_LAYOUT = {
  NAVIGATION_BAR_HEIGHT_PX: 52,
  ACTIVITY_HEADER_HEIGHT_PX: 48,
  HOME_ICON_CELL_WIDTH_PX: 86,
  HOME_ICON_CELL_HEIGHT_PX: 96,
  HOME_FALLBACK_COLUMNS: 4,
  HOME_FALLBACK_ROWS: 4,
  HOME_PAGE_GAP_PX: 12,
  MENU_Z_INDEX: 100,
  DIALOG_Z_INDEX: 200,
} as const;

export const MOBILE_LAYOUT_CSS_VARIABLES: CSSProperties &
  Record<`--${string}`, string> = {
  "--android-navigation-bar-height": `${MOBILE_LAYOUT.NAVIGATION_BAR_HEIGHT_PX}px`,
  "--android-activity-header-height": `${MOBILE_LAYOUT.ACTIVITY_HEADER_HEIGHT_PX}px`,
  "--android-menu-z-index": `${MOBILE_LAYOUT.MENU_Z_INDEX}`,
  "--android-dialog-z-index": `${MOBILE_LAYOUT.DIALOG_Z_INDEX}`,
};

export const MOBILE_CSS_VARIABLE = {
  HOME_WALLPAPER_IMAGE: "--android-home-wallpaper-image",
} as const;

export const MOBILE_ASSET_PATHS = {
  DOCUMENTS: "/assets/android/documents.svg",
  COMPUTER: "/assets/android/computer.svg",
  RECYCLE_BIN: "/assets/android/recycle-bin.svg",
  FOLDER: "/assets/android/folder.svg",
  FILE: "/assets/android/file.svg",
  MEMO: "/assets/android/memo.svg",
  CHECKLIST: "/assets/android/checklist.svg",
  STORAGE_STATUS: "/assets/android/storage-status.svg",
} as const;

export const MOBILE_WIDGET_ICON_PATH = {
  [WIDGET_TYPE.MEMO]: MOBILE_ASSET_PATHS.MEMO,
  [WIDGET_TYPE.DAILY_CHECKLIST]: MOBILE_ASSET_PATHS.CHECKLIST,
  [WIDGET_TYPE.STORAGE_STATUS]: MOBILE_ASSET_PATHS.STORAGE_STATUS,
} as const satisfies Partial<
  Record<(typeof WIDGET_TYPE)[keyof typeof WIDGET_TYPE], string>
>;

export const MOBILE_ACTIVITY_KIND = {
  HOME: "home",
  DIRECTORY: "directory",
  COMPUTER: "computer",
  TRASH: "trash",
  MEDIA: "media",
  WIDGET_FILE: "widget-file",
  WIDGET_DRAFT: "widget-draft",
  STORAGE_STATUS: "storage-status",
  WALLPAPER: "wallpaper",
} as const;

export const MOBILE_ACTIVITY_MENU_AVAILABILITY = {
  [MOBILE_ACTIVITY_KIND.HOME]: true,
  [MOBILE_ACTIVITY_KIND.DIRECTORY]: true,
  [MOBILE_ACTIVITY_KIND.COMPUTER]: false,
  [MOBILE_ACTIVITY_KIND.TRASH]: true,
  [MOBILE_ACTIVITY_KIND.MEDIA]: true,
  [MOBILE_ACTIVITY_KIND.WIDGET_FILE]: false,
  [MOBILE_ACTIVITY_KIND.WIDGET_DRAFT]: true,
  [MOBILE_ACTIVITY_KIND.STORAGE_STATUS]: false,
  [MOBILE_ACTIVITY_KIND.WALLPAPER]: false,
} as const;

export const MOBILE_SYSTEM_ITEM_ID = {
  DOCUMENTS: "mobile-system-documents",
  COMPUTER: "mobile-system-computer",
  RECYCLE_BIN: "mobile-system-recycle-bin",
} as const;

export const MOBILE_NAVIGATION_GLYPH = {
  BACK: "↩",
  HOME: "⌂",
  MENU: "▤",
} as const;

export const MOBILE_CLASS_NAME = {
  ROOT: "android-mobile",
  SCREEN: "android-mobile__screen",
  ACTIVITY: "android-activity",
  ACTIVITY_HEADER: "android-activity__header",
  ACTIVITY_TITLE: "android-activity__title",
  ACTIVITY_CONTENT: "android-activity__content",
  NAVIGATION: "android-navigation",
  NAVIGATION_BUTTON: "android-navigation__button",
  MENU: "android-menu",
  MENU_BACKDROP: "android-menu__backdrop",
  MENU_PANEL: "android-menu__panel",
  HOME: "android-home",
  HOME_PAGES: "android-home__pages",
  HOME_PAGE: "android-home__page",
  HOME_INDICATOR: "android-home__indicator",
  HOME_DOT: "android-home__dot",
  ICON: "android-icon",
  ICON_IMAGE: "android-icon__image",
  ICON_LABEL: "android-icon__label",
  LIST: "android-list",
  LIST_ITEM: "android-list__item",
  LIST_ICON: "android-list__icon",
  LIST_TEXT: "android-list__text",
  LIST_META: "android-list__meta",
  BREADCRUMBS: "android-breadcrumbs",
  MESSAGE: "android-message",
  ERROR: "android-message android-message--error",
  BUTTON_ROW: "android-button-row",
  DIALOG_BACKDROP: "android-dialog__backdrop",
  DIALOG: "android-dialog",
  FORM: "android-form",
  FIELD: "android-form__field",
  WIDGET: "android-widget",
  TOOLBAR: "android-widget__toolbar",
  WIDGET_CHECKLIST: "android-widget__checklist",
  WIDGET_PANEL: "android-widget__panel",
  MEDIA: "android-media",
  MEDIA_VIEWPORT: "android-media__viewport",
  MEDIA_NAVIGATION_ERROR: "android-media__navigation-error",
  MEDIA_ACTIONS: "android-media__actions",
  FOLDER_DETAILS: "android-folder-details",
  FOLDER_DETAILS_ROW: "android-folder-details__row",
  FOLDER_SORT: "android-folder-sort",
  WALLPAPER: "android-wallpaper",
  WALLPAPER_ROOTS: "android-wallpaper__roots",
  WALLPAPER_PREVIEW: "android-wallpaper__preview",
  WALLPAPER_PREVIEW_IMAGE: "android-wallpaper__preview-image",
  WALLPAPER_PREVIEW_DEFAULT: "android-wallpaper__preview-default",
  WALLPAPER_DEFAULT: "android-wallpaper__default",
  WALLPAPER_SELECTED: "android-wallpaper__selected",
  WALLPAPER_ERROR: "android-wallpaper__error",
  WALLPAPER_ACTIONS: "android-wallpaper__actions",
} as const;
