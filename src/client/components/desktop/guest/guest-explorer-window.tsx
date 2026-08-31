import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type {
  FilesystemBreadcrumb,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";
import { DesktopAppWindow } from "@client/components/desktop/desktop-app-window";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";
import { XpExplorerHeader } from "@client/components/filesystem/header/xp-explorer-header";
import {
  XP_EXPLORER_HEADER_CLASS_NAME,
  XP_EXPLORER_MENU_ACCESS_KEY,
  XP_EXPLORER_MENU_ID,
  XP_EXPLORER_TOOLBAR_ACTION,
} from "@client/constants/filesystem/explorer-header";
import { XP_CONTEXT_MENU_COMMAND_ID } from "@client/constants/context-menu/context-menu";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { SYSTEM_APP_CONFIG, SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import { contextMenuCommand } from "@client/domain/context-menu/context-menu";
import { usePaginatedDirectory } from "@client/hooks/filesystem/directory/use-paginated-directory";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import type {
  DesktopDimensions,
  WindowBounds,
} from "@client/types/desktop/desktop";
import type { ExplorerWindowState } from "@client/types/filesystem/filesystem";
import type { XpExplorerMenu, XpExplorerToolbarItem } from "@client/types/filesystem/explorer-header";
import type { GuestGateway } from "@client/types/guest/guest";
import { downloadFile } from "@client/utils/download-file";
import { formatFileSize } from "@client/utils/format-file-size";

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
  const [history, setHistory] = useState<readonly FilesystemBreadcrumb[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = usePaginatedDirectory({
    gateway,
    directoryId: window.directoryId,
    errorFallback: GUEST_COPY.LOAD_FAILED,
  });
  const page = query.page;
  const selected = page?.items.find((entry) => entry.id === selectedId) ?? null;

  useEffect(() => setSelectedId(null), [window.directoryId]);

  const navigate = (target: FilesystemBreadcrumb, remember = true): void => {
    if (target.id === window.directoryId) return;
    if (remember && page) {
      setHistory((current) => [
        ...current,
        { id: page.directory.id, name: page.directory.name },
      ]);
    }
    onDirectoryChanged(target.id, target.name);
  };
  const goBack = (): void => {
    const target = history.at(-1);
    if (!target) return;
    setHistory((current) => current.slice(0, -1));
    navigate(target, false);
  };
  const parent = page?.breadcrumbs.at(-2) ?? null;
  const downloadSelected = (): void => {
    if (selected?.kind === FILESYSTEM_ENTRY_KIND.FILE) {
      downloadFile(gateway.downloadUrl(selected.id));
    }
  };
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
            query.reload,
          ),
        ],
      },
    ],
    [onClose, query.reload, selected],
  );
  const toolbarItems = useMemo<readonly XpExplorerToolbarItem[]>(
    () => [
      {
        action: XP_EXPLORER_TOOLBAR_ACTION.BACK,
        label: FILESYSTEM_COPY.BACK,
        disabled: history.length === 0,
        onSelect: goBack,
      },
      {
        action: XP_EXPLORER_TOOLBAR_ACTION.UP,
        label: FILESYSTEM_COPY.UP,
        disabled: !parent,
        onSelect: () => {
          if (parent) navigate(parent);
        },
      },
      { id: "guest-download-separator", separator: true },
      {
        action: XP_EXPLORER_TOOLBAR_ACTION.DOWNLOAD,
        label: GUEST_COPY.DOWNLOAD,
        disabled: selected?.kind !== FILESYSTEM_ENTRY_KIND.FILE,
        onSelect: downloadSelected,
      },
    ],
    [history.length, parent, selected],
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
      navigate({ id: entry.id, name: entry.name });
    } else {
      onOpenEntry(entry, window.directoryId);
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
              ? page.breadcrumbs.map((breadcrumb, index) => (
                  <span key={breadcrumb.id}>
                    {index > 0 ? (
                      <span
                        className={XP_EXPLORER_HEADER_CLASS_NAME.BREADCRUMB_SEPARATOR}
                        aria-hidden="true"
                      >
                        {"\\"}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={XP_EXPLORER_HEADER_CLASS_NAME.BREADCRUMB}
                      onClick={() => navigate(breadcrumb)}
                    >
                      {breadcrumb.name}
                    </button>
                  </span>
                ))
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
      {query.error ? (
        <p className="explorer-message" role="alert">{query.error}</p>
      ) : null}
      {query.isInitialLoading && !page ? (
        <p className="explorer-message">{FILESYSTEM_COPY.BUSY}</p>
      ) : null}
      {page ? (
        <div className="explorer-content">
          {page.items.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={
                selectedId === entry.id
                  ? "explorer-item explorer-item--selected"
                  : "explorer-item"
              }
              aria-pressed={selectedId === entry.id}
              onClick={() => setSelectedId(entry.id)}
              onDoubleClick={() => openEntry(entry)}
              onKeyDown={(event) => {
                if (event.key === KEYBOARD_KEY.ENTER) openEntry(entry);
              }}
              onContextMenu={(event) => openContextMenu(entry, event)}
            >
              <FilesystemEntryIcon
                entry={entry}
                thumbnailUrl={gateway.thumbnailUrl.bind(gateway)}
              />
              <span>{entry.name}</span>
              {entry.kind === FILESYSTEM_ENTRY_KIND.FILE ? (
                <small>{formatFileSize(entry.size)}</small>
              ) : null}
            </button>
          ))}
          {page.items.length === 0 ? (
            <p className="explorer-empty">{GUEST_COPY.EMPTY_DIRECTORY}</p>
          ) : null}
          {page.nextOffset !== null ? (
            <button
              type="button"
              className="explorer-load-more"
              disabled={query.isLoadingMore}
              onClick={() => void query.loadMore()}
            >
              {query.isLoadingMore ? FILESYSTEM_COPY.BUSY : FILESYSTEM_COPY.LOAD_MORE}
            </button>
          ) : null}
        </div>
      ) : null}
    </DesktopAppWindow>
  );
}
