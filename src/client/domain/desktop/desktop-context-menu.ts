import { FOLDER_PROPERTIES_COPY } from "@client/content/ko/filesystem/details";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { XP_CONTEXT_MENU_COPY } from "@client/content/ko/context-menu/context-menu";
import type { WidgetType } from "@/types/widgets/widget";
import { XP_CONTEXT_MENU_COMMAND_ID } from "@client/constants/context-menu/context-menu";
import { APPLICATION_NAME_BY_TYPE } from "@client/content/ko/desktop/application";
import {
  DESKTOP_APPLICATION_CATALOG,
} from "@client/constants/desktop/application-catalog";
import { APPLICATION_LAUNCH_LOCATION } from "@client/constants/desktop/application";
import { SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import {
  contextMenuCommand,
  contextMenuSeparator,
} from "@client/domain/context-menu/context-menu";
import type { XpContextMenuItem } from "@client/types/context-menu/context-menu";
import type { SystemAppId } from "@client/types/desktop/system-app";

interface DesktopBlankMenuActions {
  readonly createDirectory: () => void;
  readonly launchApplication: (type: WidgetType) => void;
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
    ...DESKTOP_APPLICATION_CATALOG.filter(({ launchLocations }) =>
      launchLocations.includes(
        APPLICATION_LAUNCH_LOCATION.DESKTOP_CONTEXT_MENU,
      ),
    ).map(({ type, contextCommandId }) =>
      contextMenuCommand(
        contextCommandId,
        APPLICATION_NAME_BY_TYPE[type],
        () => actions.launchApplication(type),
      ),
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
