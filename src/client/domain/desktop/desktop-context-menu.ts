import { WIDGET_TYPE } from "@/constants/widgets/widget";
import {
  XP_CONTEXT_MENU_COMMAND_ID,
  XP_CONTEXT_MENU_COPY,
} from "@client/constants/context-menu/context-menu";
import { FOLDER_PROPERTIES_COPY } from "@client/constants/filesystem/details";
import { FILESYSTEM_COPY } from "@client/constants/filesystem/filesystem";
import { DASHBOARD_COPY } from "@client/constants/widgets/content";
import { SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import {
  contextMenuCommand,
  contextMenuSeparator,
} from "@client/domain/context-menu/context-menu";
import type { XpContextMenuItem } from "@client/types/context-menu/context-menu";
import type { SystemAppId } from "@client/types/desktop/system-app";

interface DesktopBlankMenuActions {
  readonly createDirectory: () => void;
  readonly addWidget: (type: typeof WIDGET_TYPE[keyof typeof WIDGET_TYPE]) => void;
  readonly refresh: () => void;
}

export function buildDesktopBlankContextMenu(
  actions: DesktopBlankMenuActions,
): readonly XpContextMenuItem[] {
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.NEW_FOLDER,
      FILESYSTEM_COPY.NEW_FOLDER,
      actions.createDirectory,
    ),
    contextMenuSeparator("desktop-blank-separator-1"),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.ADD_MEMO,
      DASHBOARD_COPY.ADD_MEMO_WIDGET,
      () => actions.addWidget(WIDGET_TYPE.MEMO),
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.ADD_CHECKLIST,
      DASHBOARD_COPY.ADD_CHECKLIST_WIDGET,
      () => actions.addWidget(WIDGET_TYPE.DAILY_CHECKLIST),
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.ADD_STORAGE_STATUS,
      DASHBOARD_COPY.ADD_STORAGE_STATUS_WIDGET,
      () => actions.addWidget(WIDGET_TYPE.STORAGE_STATUS),
    ),
    contextMenuSeparator("desktop-blank-separator-2"),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.REFRESH,
      FILESYSTEM_COPY.REFRESH,
      actions.refresh,
    ),
  ];
}

interface DesktopSystemMenuActions {
  readonly open: () => void;
  readonly showProperties: () => void;
}

export function buildDesktopSystemContextMenu(
  id: SystemAppId,
  actions: DesktopSystemMenuActions,
): readonly XpContextMenuItem[] {
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.OPEN,
      FILESYSTEM_COPY.OPEN,
      actions.open,
    ),
    ...(id === SYSTEM_APP_ID.DOCUMENTS
      ? [
          contextMenuSeparator("desktop-system-separator-1"),
          contextMenuCommand(
            XP_CONTEXT_MENU_COMMAND_ID.PROPERTIES,
            FOLDER_PROPERTIES_COPY.PROPERTIES,
            actions.showProperties,
          ),
        ]
      : []),
  ];
}

export function buildDesktopRootContextMenu(actions: {
  readonly openStorageStatus: () => void;
  readonly refreshPage: () => void;
}): readonly XpContextMenuItem[] {
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.STORAGE_STATUS,
      XP_CONTEXT_MENU_COPY.STORAGE_STATUS,
      actions.openStorageStatus,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.REFRESH_PAGE,
      XP_CONTEXT_MENU_COPY.REFRESH_PAGE,
      actions.refreshPage,
    ),
  ];
}
