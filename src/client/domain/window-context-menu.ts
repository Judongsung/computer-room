import { DASHBOARD_COPY } from "../constants/content";
import { XP_CONTEXT_MENU_COMMAND_ID } from "../constants/context-menu";
import type { XpContextMenuItem } from "../types/context-menu";
import { contextMenuCommand } from "./context-menu";

interface WindowContextMenuOptions {
  readonly isMaximized: boolean;
  readonly onMinimize: () => void;
  readonly onToggleMaximize: () => void;
  readonly onClose: () => void;
}

export function windowContextMenuItems({
  isMaximized,
  onMinimize,
  onToggleMaximize,
  onClose,
}: WindowContextMenuOptions): readonly XpContextMenuItem[] {
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.RESTORE,
      DASHBOARD_COPY.RESTORE,
      onToggleMaximize,
      !isMaximized,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.MINIMIZE,
      DASHBOARD_COPY.MINIMIZE,
      onMinimize,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.MAXIMIZE,
      DASHBOARD_COPY.MAXIMIZE,
      onToggleMaximize,
      isMaximized,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.CLOSE,
      DASHBOARD_COPY.CLOSE,
      onClose,
    ),
  ];
}
