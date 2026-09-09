import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { DesktopAppWindow } from "@client/components/desktop/desktop-app-window";
import { ExplorerDirectoryView } from "@client/components/filesystem/explorer/explorer-directory-view";
import { ExplorerBreadcrumbs } from "@client/components/filesystem/header/explorer-breadcrumbs";
import { XpExplorerHeader } from "@client/components/filesystem/header/xp-explorer-header";
import {
  XP_EXPLORER_HEADER_CLASS_NAME,
  XP_EXPLORER_MENU_ACCESS_KEY,
  XP_EXPLORER_MENU_ID,
  XP_EXPLORER_TOOLBAR_ACTION,
} from "@client/constants/filesystem/explorer-header";
import { XP_CONTEXT_MENU_COMMAND_ID } from "@client/constants/context-menu/context-menu";
import { SYSTEM_APP_CONFIG, SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import { contextMenuCommand } from "@client/domain/context-menu/context-menu";
import { useDirectoryNavigation } from "@client/hooks/filesystem/directory/use-directory-navigation";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import type { DesktopDimensions, WindowBounds } from "@client/types/desktop/window";
import type { ExplorerWindowState } from "@client/types/filesystem/filesystem";
import type { XpExplorerMenu, XpExplorerToolbarItem } from "@client/types/filesystem/explorer-header";
import type { GuestGateway } from "@client/types/guest/guest";
import { downloadFile } from "@client/utils/download-file";

interface GuestExplorerWindowProps {
  readonly window: ExplorerWindowState;
  readonly desktop: DesktopDimensions;
  readonly gateway: GuestGateway;
  readonly isActive: boolean;
  readonly zIndex: number;
  readonly onFocus: () => void;
  readonly onMinimize: () => void;
  readonly onToggleMaximize: () => void;
  readonly onClose: () => void;
  readonly onCommitBounds: (bounds: WindowBounds) => void;
  readonly onDirectoryChanged: (directoryId: string, title: string) => void;
  readonly onOpenEntry: (entry: FilesystemEntry, directoryId: string) => void;
}

export function GuestExplorerWindow({
  window,
  desktop,
  gateway,
  isActive,
  zIndex,
  onFocus,
  onMinimize,
  onToggleMaximize,
  onClose,
  onCommitBounds,
  onDirectoryChanged,
  onOpenEntry,
}: GuestExplorerWindowProps) {
  const contextMenu = useXpContextMenu();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const handleDirectoryLoaded = useCallback(
    (directoryId: string, nextTitle: string): void => {
      onDirectoryChanged(directoryId, nextTitle);
    },
    [onDirectoryChanged],
  );
  const explorer = useDirectoryNavigation({
    gateway,
    initialDirectoryId: window.directoryId,
    errorFallback: GUEST_COPY.LOAD_FAILED,
    onDirectoryLoaded: handleDirectoryLoaded,
  });
  const page = explorer.page;
  const selected = page?.items.find((entry) => entry.id === selectedId) ?? null;

  useEffect(() => setSelectedId(null), [explorer.directoryId]);

  const parent = page?.breadcrumbs.at(-2) ?? null;
  const downloadSelected = useCallback((): void => {
    if (selected?.kind === FILESYSTEM_ENTRY_KIND.FILE) {
      downloadFile(gateway.downloadUrl(selected.id));
    }
  }, [gateway, selected]);
  const menus = useMemo<readonly XpExplorerMenu[]>(
    () => [
      {
        id: XP_EXPLORER_MENU_ID.FILE,
        label: XP_EXPLORER_HEADER_COPY.FILE_MENU,
        accessKey: XP_EXPLORER_MENU_ACCESS_KEY[XP_EXPLORER_MENU_ID.FILE],
        items: [
          contextMenuCommand(
            XP_CONTEXT_MENU_COMMAND_ID.DOWNLOAD,
            GUEST_COPY.DOWNLOAD,
            downloadSelected,
            selected?.kind !== FILESYSTEM_ENTRY_KIND.FILE,
          ),
          contextMenuCommand(
            XP_CONTEXT_MENU_COMMAND_ID.CLOSE,
            GUEST_COPY.CLOSE,
            onClose,
          ),
        ],
      },
      {
        id: XP_EXPLORER_MENU_ID.VIEW,
        label: XP_EXPLORER_HEADER_COPY.VIEW_MENU,
        accessKey: XP_EXPLORER_MENU_ACCESS_KEY[XP_EXPLORER_MENU_ID.VIEW],
        items: [
          contextMenuCommand(
            XP_CONTEXT_MENU_COMMAND_ID.REFRESH,
            GUEST_COPY.REFRESH,
            explorer.reload,
          ),
        ],
      },
    ],
    [downloadSelected, explorer.reload, onClose, selected],
  );
  const toolbarItems = useMemo<readonly XpExplorerToolbarItem[]>(
    () => [
      {
        action: XP_EXPLORER_TOOLBAR_ACTION.BACK,
        label: FILESYSTEM_COPY.BACK,
        disabled: explorer.history.length === 0,
        onSelect: explorer.navigateBack,
      },
      {
        action: XP_EXPLORER_TOOLBAR_ACTION.UP,
        label: FILESYSTEM_COPY.UP,
        disabled: !parent,
        onSelect: explorer.navigateUp,
      },
      { id: "guest-download-separator", separator: true },
      {
        action: XP_EXPLORER_TOOLBAR_ACTION.DOWNLOAD,
        label: GUEST_COPY.DOWNLOAD,
        disabled: selected?.kind !== FILESYSTEM_ENTRY_KIND.FILE,
        onSelect: downloadSelected,
      },
    ],
    [downloadSelected, explorer.history.length, explorer.navigateBack, explorer.navigateUp, parent, selected],
  );

  const openContextMenu = (
    entry: FilesystemEntry,
    event: MouseEvent<HTMLButtonElement>,
  ): void => {
    setSelectedId(entry.id);
    contextMenu.openFromEvent(event, [
      contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.OPEN, GUEST_COPY.OPEN, () =>
        openEntry(entry),
      ),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.DOWNLOAD,
        GUEST_COPY.DOWNLOAD,
        () => downloadFile(gateway.downloadUrl(entry.id)),
        entry.kind !== FILESYSTEM_ENTRY_KIND.FILE,
      ),
    ]);
  };
  const openEntry = (entry: FilesystemEntry): void => {
    if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      explorer.navigate(entry.id);
    } else {
      onOpenEntry(entry, explorer.directoryId);
    }
  };

  return (
    <DesktopAppWindow
      title={window.title}
      iconPath={window.iconPath}
      window={window}
      desktop={desktop}
      isActive={isActive}
      zIndex={zIndex}
      minWidth={SYSTEM_APP_CONFIG[SYSTEM_APP_ID.DOCUMENTS].minWidth}
      minHeight={SYSTEM_APP_CONFIG[SYSTEM_APP_ID.DOCUMENTS].minHeight}
      toolbarClassName={XP_EXPLORER_HEADER_CLASS_NAME.FRAME_TOOLBAR}
      toolbar={
        <XpExplorerHeader
          menus={menus}
          toolbarItems={toolbarItems}
          locationIconPath={window.iconPath}
          address={
            page
              ? <ExplorerBreadcrumbs
                  items={page.breadcrumbs}
                  onNavigate={(breadcrumb) => explorer.navigate(breadcrumb.id)}
                />
              : window.title
          }
        />
      }
      bodyClassName="explorer-window__body"
      footer={
        <footer className="explorer-statusbar">
          {GUEST_COPY.ITEM_COUNT(page?.items.length ?? 0)}
        </footer>
      }
      onFocus={onFocus}
      onMinimize={onMinimize}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
      onCommitBounds={onCommitBounds}
    >
      {explorer.error ? (
        <p className="explorer-message" role="alert">{explorer.error}</p>
      ) : null}
      {explorer.isInitialLoading && !page ? (
        <p className="explorer-message">{FILESYSTEM_COPY.BUSY}</p>
      ) : null}
      {page ? (
        <ExplorerDirectoryView
          page={page}
          busy={explorer.isLoadingMore}
          currentDirectoryId={explorer.directoryId}
          selection={{
            selectedIds: selectedId ? new Set([selectedId]) : new Set(),
            onSelect: (id) => setSelectedId(id),
          }}
          thumbnailUrl={gateway.thumbnailUrl.bind(gateway)}
          emptyLabel={GUEST_COPY.EMPTY_DIRECTORY}
          loadMoreLabel={
            explorer.isLoadingMore
              ? FILESYSTEM_COPY.BUSY
              : FILESYSTEM_COPY.LOAD_MORE
          }
          onOpenEntry={openEntry}
          onLoadMore={() => void explorer.loadMore()}
          contextMenu={{
            onEntry: openContextMenu,
          }}
        />
      ) : null}
    </DesktopAppWindow>
  );
}
