import { DESKTOP_LAYOUT } from "@client/constants/desktop/desktop";
import type { DesktopDimensions } from "@client/types/desktop/window";

export interface DesktopIconLayout {
  readonly rowCount: number;
  readonly columnCount: number;
  readonly dynamicCapacity: number;
}

export function desktopIconLayout(
  desktop: DesktopDimensions,
  fixedShortcutCount: number = DESKTOP_LAYOUT.FIXED_SHORTCUT_COUNT,
): DesktopIconLayout {
  const rowStride =
    DESKTOP_LAYOUT.SHORTCUT_ROW_HEIGHT_PX + DESKTOP_LAYOUT.SHORTCUT_GAP_PX;
  const columnStride =
    DESKTOP_LAYOUT.SHORTCUT_WIDTH_PX + DESKTOP_LAYOUT.SHORTCUT_GAP_PX;
  const rowCount = Math.max(
    1,
    Math.floor(
      (desktop.height - DESKTOP_LAYOUT.SHORTCUT_TOP_PX +
        DESKTOP_LAYOUT.SHORTCUT_GAP_PX) /
        rowStride,
    ),
  );
  const columnCount = Math.max(
    1,
    Math.floor(
      (desktop.width - DESKTOP_LAYOUT.SHORTCUT_LEFT_PX +
        DESKTOP_LAYOUT.SHORTCUT_GAP_PX) /
        columnStride,
    ),
  );
  return {
    rowCount,
    columnCount,
    dynamicCapacity: Math.max(
      0,
      rowCount * columnCount - fixedShortcutCount,
    ),
  };
}
