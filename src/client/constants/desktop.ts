import { WIDGET_TYPE } from "../../constants/widget";
import { KOREA_TIME_ZONE } from "../../constants/date";

export const DESKTOP_LAYOUT = {
  MIN_WIDTH_PX: 1_024,
  MIN_HEIGHT_PX: 640,
  TASKBAR_HEIGHT_PX: 34,
  START_BUTTON_WIDTH_PX: 120,
  START_MENU_WIDTH_PX: 386,
  START_MENU_HEADER_HEIGHT_PX: 58,
  START_MENU_CONTENT_MIN_HEIGHT_PX: 190,
  START_MENU_FOOTER_HEIGHT_PX: 40,
  WINDOW_TITLE_BAR_HEIGHT_PX: 31,
  WINDOW_TITLE_ICON_SIZE_PX: 16,
  WINDOW_FRAME_BORDER_WIDTH_PX: 3,
  WINDOW_CONTROL_SIZE_PX: 22,
  WINDOW_TOOLBAR_HEIGHT_PX: 32,
  INITIAL_WINDOW_OFFSET_PX: 32,
  WINDOW_CASCADE_STEP_PX: 32,
  SHORTCUT_LEFT_PX: 12,
  SHORTCUT_TOP_PX: 12,
  SHORTCUT_WIDTH_PX: 88,
  SHORTCUT_ICON_SIZE_PX: 48,
  SHORTCUT_GAP_PX: 12,
  BASE_WINDOW_Z_INDEX: 10,
  START_MENU_Z_INDEX: 10_000,
  TASKBAR_Z_INDEX: 10_001,
  MODAL_Z_INDEX: 20_000,
} as const;

export const DESKTOP_FALLBACK_WORK_AREA = {
  WIDTH_PX: DESKTOP_LAYOUT.MIN_WIDTH_PX,
  HEIGHT_PX:
    DESKTOP_LAYOUT.MIN_HEIGHT_PX - DESKTOP_LAYOUT.TASKBAR_HEIGHT_PX,
} as const;

export const DESKTOP_WINDOW_CLASS_NAME = {
  ROOT: "desktop-window",
  MAXIMIZED: "desktop-window--maximized",
} as const;

export const DESKTOP_ASSET_PATHS = {
  BACKGROUND: "/assets/windows-xp/desktop-bg.jpg",
  START_LOGO: "/assets/windows-xp/logo.svg",
  START_BUTTON_MASK: "/assets/shizuku-winxp/start-button-mask.png",
  POWER_ICON: "/assets/shizuku-winxp/power.png",
  MEMO_ICON: "/assets/windows-xp/notepad.png",
  CHECKLIST_ICON: "/assets/windows-xp/file.png",
  DOCUMENTS_ICON: "/assets/windows-xp/documents.png",
  COMPUTER_ICON: "/assets/windows-xp/computer.png",
  RECYCLE_BIN_ICON: "/assets/windows-xp/recycle.png",
  FOLDER_ICON: "/assets/windows-xp/folder.png",
  FILE_ICON: "/assets/windows-xp/file.png",
  PICTURE_VIEWER_ICON: "/assets/computer-room/picture-viewer.svg",
  MEDIA_PLAYER_ICON: "/assets/computer-room/media-player.svg",
} as const;

export const WIDGET_ICON_PATH_BY_TYPE = {
  [WIDGET_TYPE.MEMO]: DESKTOP_ASSET_PATHS.MEMO_ICON,
  [WIDGET_TYPE.DAILY_CHECKLIST]: DESKTOP_ASSET_PATHS.CHECKLIST_ICON,
} as const;

export const KOREA_TIME_FORMAT_OPTIONS = {
  timeZone: KOREA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
} as const satisfies Intl.DateTimeFormatOptions;

export const KOREA_DATE_TIME_FORMAT_OPTIONS = {
  timeZone: KOREA_TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
} as const satisfies Intl.DateTimeFormatOptions;

export const DESKTOP_CLOCK_REFRESH_MILLISECONDS = 1_000;
