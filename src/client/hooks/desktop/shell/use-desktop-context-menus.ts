import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useCallback } from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { WidgetType } from "@/types/widgets/widget";
import {
  buildDesktopBlankContextMenu,
  buildDesktopRootContextMenu,
  buildDesktopSystemContextMenu,
} from "@client/domain/desktop/desktop-context-menu";
import { buildExplorerEntryContextMenu } from "@client/domain/filesystem/explorer-context-menu";
import type { useFilesystemDownload } from "@client/hooks/filesystem/use-filesystem-download";
import type { useFilesystemSelection } from "@client/hooks/filesystem/use-filesystem-selection";
import type { useFolderProperties } from "@client/hooks/filesystem/use-folder-properties";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import type { DesktopFilesystemDialog } from "@client/types/filesystem/filesystem";
import type { SystemAppId } from "@client/types/desktop/system-app";

interface DesktopContextMenuOptions {
  readonly selectedEntries: readonly FilesystemEntry[];
  readonly selection: ReturnType<typeof useFilesystemSelection>;
  readonly download: ReturnType<typeof useFilesystemDownload>;
  readonly folderProperties: ReturnType<typeof useFolderProperties>;
  readonly setDialog: (dialog: DesktopFilesystemDialog) => void;
  readonly trashEntries: (entries: readonly FilesystemEntry[]) => void;
  readonly notifyFilesystemChanged: () => void;
  readonly openFilesystemEntry: (entry: FilesystemEntry) => void;
  readonly openSystemShortcut: (id: SystemAppId) => void;
  readonly launchApplication: (type: WidgetType) => void;
  readonly setSelectedSystemShortcutId: (id: SystemAppId | null) => void;
}

export function useDesktopContextMenus({
  selectedEntries,
  selection,
  download,
  folderProperties,
  setDialog,
  trashEntries,
  notifyFilesystemChanged,
  openFilesystemEntry,
  openSystemShortcut,
  launchApplication,
  setSelectedSystemShortcutId,
}: DesktopContextMenuOptions) {
  const contextMenu = useXpContextMenu();

  const openEntryMenu = useCallback(
    (entry: FilesystemEntry, event: ContextMenuEvent): void => {
      const entries = selection.selectedIds.has(entry.id) ? selectedEntries : [entry];
      if (!selection.selectedIds.has(entry.id)) selection.replace([entry.id]);
      setSelectedSystemShortcutId(null);
      contextMenu.openFromEvent(
        event,
        buildExplorerEntryContextMenu(entries, {
          open: () => openFilesystemEntry(entries[0] ?? entry),
          download: () => download.start(entries),
          rename: () => setDialog({ kind: "rename", entries }),
          move: () => setDialog({ kind: "move", entries }),
          trash: () => trashEntries(entries),
          showProperties: () => {
            const directory = entries[0];
            if (directory?.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
              folderProperties.open(directory);
            }
          },
        }),
        FILESYSTEM_COPY.CONTEXT_MENU,
      );
    },
    [contextMenu, download, folderProperties, openFilesystemEntry, selectedEntries, selection, setDialog, setSelectedSystemShortcutId, trashEntries],
  );

  const openBlankMenu = useCallback(
    (event: ContextMenuEvent): void => {
      contextMenu.openFromEvent(
        event,
        buildDesktopBlankContextMenu({
          createDirectory: () => setDialog({ kind: "create" }),
          launchApplication,
          refresh: notifyFilesystemChanged,
        }),
      );
    },
    [contextMenu, launchApplication, notifyFilesystemChanged, setDialog],
  );

  const openSystemMenu = useCallback(
    (id: SystemAppId, event: ContextMenuEvent): void => {
      setSelectedSystemShortcutId(id);
      selection.clear();
      contextMenu.openFromEvent(
        event,
        buildDesktopSystemContextMenu(id, {
          open: () => openSystemShortcut(id),
          showProperties: () =>
            folderProperties.open({
              id: FILESYSTEM_ROOT_ID.DOCUMENTS,
              name: FILESYSTEM_ROOT_NAME.DOCUMENTS,
            }),
        }),
      );
    },
    [contextMenu, folderProperties, openSystemShortcut, selection.clear, setSelectedSystemShortcutId],
  );

  const openRootMenu = useCallback(
    (event: ContextMenuEvent): void => {
      contextMenu.openFromEvent(
        event,
        buildDesktopRootContextMenu({
          openStorageStatus: () =>
            launchApplication(WIDGET_TYPE.STORAGE_STATUS),
          refreshPage: () => window.location.reload(),
        }),
      );
    },
    [contextMenu, launchApplication],
  );

  return {
    contextMenu,
    openEntryMenu,
    openBlankMenu,
    openSystemMenu,
    openRootMenu,
  } as const;
}

interface ContextMenuEvent {
  preventDefault: () => void;
  stopPropagation: () => void;
  clientX: number;
  clientY: number;
}
