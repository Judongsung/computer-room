import { FOLDER_PROPERTIES_COPY } from "@client/content/ko/filesystem/details";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import {
  XP_CONTEXT_MENU_COMMAND_ID,
} from "@client/constants/context-menu/context-menu";
import {
  contextMenuCommand,
  contextMenuSeparator,
} from "@client/domain/context-menu/context-menu";
import type { XpContextMenuItem } from "@client/types/context-menu/context-menu";

interface ExplorerEntryMenuActions {
  readonly open: () => void;
  readonly download: () => void | Promise<unknown>;
  readonly rename: () => void;
  readonly move: () => void;
  readonly trash: () => void | Promise<unknown>;
  readonly showProperties: () => void;
}

export function buildExplorerEntryContextMenu(
  entries: readonly FilesystemEntry[],
  actions: ExplorerEntryMenuActions,
): readonly XpContextMenuItem[] {
  const directory =
    entries.length === 1 &&
    entries[0]?.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY;
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.OPEN,
      FILESYSTEM_COPY.OPEN,
      actions.open,
      entries.length !== 1,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.DOWNLOAD,
      FILESYSTEM_COPY.DOWNLOAD,
      actions.download,
      entries.every((entry) => entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET),
    ),
    contextMenuSeparator("explorer-entry-separator-1"),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.RENAME,
      FILESYSTEM_COPY.RENAME,
      actions.rename,
      entries.length !== 1,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.MOVE,
      FILESYSTEM_COPY.MOVE,
      actions.move,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.TRASH,
      FILESYSTEM_COPY.DELETE,
      actions.trash,
    ),
    ...(directory
      ? [
          contextMenuSeparator("explorer-entry-separator-2"),
          contextMenuCommand(
            XP_CONTEXT_MENU_COMMAND_ID.PROPERTIES,
            FOLDER_PROPERTIES_COPY.PROPERTIES,
            actions.showProperties,
          ),
        ]
      : []),
  ];
}

interface ExplorerDirectoryMenuState {
  readonly canMutate: boolean;
  readonly busy: boolean;
  readonly hasPage: boolean;
}

interface ExplorerDirectoryMenuActions {
  readonly createDirectory: () => void;
  readonly uploadFiles: () => void;
  readonly uploadFolder: () => void;
  readonly refresh: () => void;
  readonly showProperties: () => void;
}

export function buildExplorerDirectoryContextMenu(
  state: ExplorerDirectoryMenuState,
  actions: ExplorerDirectoryMenuActions,
): readonly XpContextMenuItem[] {
  const mutationDisabled = !state.canMutate || state.busy;
  return [
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.NEW_FOLDER,
      FILESYSTEM_COPY.NEW_FOLDER,
      actions.createDirectory,
      mutationDisabled,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.UPLOAD_FILES,
      FILESYSTEM_COPY.UPLOAD_FILES,
      actions.uploadFiles,
      mutationDisabled,
    ),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.UPLOAD_FOLDER,
      FILESYSTEM_COPY.UPLOAD_FOLDER,
      actions.uploadFolder,
      mutationDisabled,
    ),
    contextMenuSeparator("explorer-directory-separator-1"),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.REFRESH,
      FILESYSTEM_COPY.REFRESH,
      actions.refresh,
    ),
    contextMenuSeparator("explorer-directory-separator-2"),
    contextMenuCommand(
      XP_CONTEXT_MENU_COMMAND_ID.PROPERTIES,
      FOLDER_PROPERTIES_COPY.PROPERTIES,
      actions.showProperties,
      !state.hasPage,
    ),
  ];
}
