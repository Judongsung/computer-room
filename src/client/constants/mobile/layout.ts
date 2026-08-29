import type { CSSProperties } from "react";

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
