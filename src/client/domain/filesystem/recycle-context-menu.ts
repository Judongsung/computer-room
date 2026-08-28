import {
  XP_CONTEXT_MENU_COMMAND_ID,
} from "@client/constants/context-menu/context-menu";
import { FILESYSTEM_COPY } from "@client/constants/filesystem/filesystem";
import {
  contextMenuCommand,
  contextMenuSeparator,
} from "@client/domain/context-menu/context-menu";
import type { XpContextMenuItem } from "@client/types/context-menu/context-menu";

interface RecycleItemMenuActions {
  readonly restore: () => void | Promise<unknown>;
  readonly permanentlyDelete: () => void;
}

export function buildRecycleItemContextMenu(
  actions: RecycleItemMenuActions,
): readonly XpContextMenuItem[] {
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.RESTORE_FILES,
      FILESYSTEM_COPY.RESTORE,
      actions.restore,
    ),
    contextMenuSeparator("recycle-item-separator-1"),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.PERMANENT_DELETE,
      FILESYSTEM_COPY.PERMANENT_DELETE,
      actions.permanentlyDelete,
    ),
  ];
}

interface RecycleContextMenuState {
  readonly hasSelection: boolean;
  readonly hasItems: boolean;
  readonly busy: boolean;
}

interface RecycleContextMenuActions {
  readonly restore: () => void | Promise<unknown>;
  readonly permanentlyDelete: () => void;
  readonly empty: () => void;
  readonly refresh: () => void;
}

export function buildRecycleContextMenu(
  state: RecycleContextMenuState,
  actions: RecycleContextMenuActions,
): readonly XpContextMenuItem[] {
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.RESTORE_FILES,
      FILESYSTEM_COPY.RESTORE,
      actions.restore,
      !state.hasSelection || state.busy,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.PERMANENT_DELETE,
      FILESYSTEM_COPY.PERMANENT_DELETE,
      actions.permanentlyDelete,
      !state.hasSelection || state.busy,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.EMPTY_RECYCLE_BIN,
      FILESYSTEM_COPY.EMPTY_RECYCLE_BIN,
      actions.empty,
      !state.hasItems || state.busy,
    ),
    contextMenuSeparator("recycle-empty-separator-1"),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.REFRESH,
      FILESYSTEM_COPY.REFRESH,
      actions.refresh,
    ),
  ];
}
