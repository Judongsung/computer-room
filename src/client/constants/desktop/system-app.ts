import { WINDOW_RESTORE_STATE, WINDOW_STATE } from "@/constants/widgets/widget";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";

export const SYSTEM_APP_ID = {
  SEARCH: "system-app-search",
  DOCUMENTS: "system-app-documents",
  MY_COMPUTER: "system-app-my-computer",
  RECYCLE_BIN: "system-app-recycle-bin",
} as const;

export const SYSTEM_APP_ID_VALUES = [
  SYSTEM_APP_ID.SEARCH,
  SYSTEM_APP_ID.DOCUMENTS,
  SYSTEM_APP_ID.MY_COMPUTER,
  SYSTEM_APP_ID.RECYCLE_BIN,
] as const;

export const SYSTEM_APP_CONFIG = {
  [SYSTEM_APP_ID.SEARCH]: {
    iconPath: DESKTOP_ASSET_PATHS.FOLDER_ICON,
    position: { x: 170, y: 70 },
    size: { width: 720, height: 500 },
    minWidth: 560,
    minHeight: 360,
  },
  [SYSTEM_APP_ID.DOCUMENTS]: {
    iconPath: DESKTOP_ASSET_PATHS.DOCUMENTS_ICON,
    position: { x: 150, y: 56 },
    size: { width: 720, height: 500 },
    minWidth: 560,
    minHeight: 360,
  },
  [SYSTEM_APP_ID.MY_COMPUTER]: {
    iconPath: DESKTOP_ASSET_PATHS.COMPUTER_ICON,
    position: { x: 190, y: 88 },
    size: { width: 620, height: 420 },
    minWidth: 480,
    minHeight: 320,
  },
  [SYSTEM_APP_ID.RECYCLE_BIN]: {
    iconPath: DESKTOP_ASSET_PATHS.RECYCLE_BIN_ICON,
    position: { x: 230, y: 120 },
    size: { width: 680, height: 460 },
    minWidth: 540,
    minHeight: 340,
  },
} as const;

export const INITIAL_SYSTEM_WINDOW_STATE = {
  windowState: WINDOW_STATE.NORMAL,
  restoreState: WINDOW_RESTORE_STATE.NORMAL,
} as const;
