import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import { KOREA_LOCALE } from "@/constants/platform/date";
import type {
  FilesystemTrashPage,
  TrashedFilesystemEntry,
} from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import {
  FILESYSTEM_COPY,
  FILESYSTEM_DRAG_SOURCE,
  FILESYSTEM_SELECTION_DATA_ATTRIBUTE,
} from "@client/constants/filesystem/filesystem";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import type {
  FilesystemGateway,
  FilesystemWindowSyncProps,
} from "@client/types/filesystem/filesystem";
import type { SystemWindowChromeProps } from "@client/types/desktop/system-app";
import { SystemAppWindow } from "@client/components/desktop/system-app-window";
import { ConfirmDialog } from "@client/components/filesystem/filesystem-dialogs";
import { writeFilesystemDragPayload } from "@client/domain/filesystem/drag";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";
import { FilesystemBatchResultDialog } from "@client/components/filesystem/filesystem-batch-result-dialog";
import { FilesystemSelectionMarquee } from "@client/components/filesystem/filesystem-selection-marquee";
import { useFilesystemSelection } from "@client/hooks/filesystem/use-filesystem-selection";
import { useFilesystemMarqueeSelection } from "@client/hooks/filesystem/use-filesystem-marquee-selection";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import { contextMenuCommand, contextMenuSeparator } from "@client/domain/context-menu/context-menu";
import { XP_CONTEXT_MENU_COMMAND_ID } from "@client/constants/context-menu/context-menu";

type RecycleDialog = "delete" | "empty" | null;
const EMPTY_ENTRY_IDS: readonly string[] = [];

interface RecycleBinWindowProps
  extends SystemWindowChromeProps,
    FilesystemWindowSyncProps {
  readonly gateway: FilesystemGateway;
  readonly desktopCapacity: number;
}

export function RecycleBinWindow({
  gateway,
  desktopCapacity,
  filesystemRevision,
  onFilesystemChanged,
  ...chrome
}: RecycleBinWindowProps) {
  const contextMenu = useXpContextMenu();
  const [page, setPage] = useState<FilesystemTrashPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<RecycleDialog>(null);
  const [batchResult, setBatchResult] = useState<FilesystemBatchResult | null>(
    null,
  );
  const listRef = useRef<HTMLDivElement>(null);
  const itemIds = useMemo(
    () => page?.items.map((item) => item.entry.id) ?? EMPTY_ENTRY_IDS,
    [page?.items],
  );
  const selection = useFilesystemSelection(itemIds);
  const marquee = useFilesystemMarqueeSelection(
    listRef,
    selection.selectedIds,
    selection.replace,
  );

  useEffect(() => {
    let active = true;
    setPage(null);
    selection.clear();
    setError(null);
    void gateway
      .listTrash()
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [filesystemRevision, gateway, selection.clear]);

  const selectedItems = useMemo(
    () =>
      page?.items.filter((item) =>
        selection.selectedIds.has(item.entry.id),
      ) ?? [],
    [page?.items, selection.selectedIds],
  );
  const runChange = useCallback(async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      setDialog(null);
      selection.clear();
      onFilesystemChanged();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }, [onFilesystemChanged, selection.clear]);
  const runBatchChange = useCallback(
    async (operation: () => Promise<FilesystemBatchResult>): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        const result = await operation();
        setDialog(null);
        setBatchResult(result.failures.length > 0 ? result : null);
        selection.replace(result.failures.map((failure) => failure.id));
        onFilesystemChanged();
      } catch (reason) {
        setError(errorMessage(reason));
      } finally {
        setBusy(false);
      }
    },
    [onFilesystemChanged, selection.replace],
  );
  const loadMore = (): void => {
    if (!page || page.nextOffset === null || busy) return;
    setBusy(true);
    setError(null);
    void gateway
      .listTrash(page.nextOffset)
      .then((next) => {
        setPage((current) =>
          current
            ? {
                items: [...current.items, ...next.items],
                nextOffset: next.nextOffset,
              }
            : current,
        );
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setBusy(false));
  };

  const openTrashItemContextMenu = (
    item: TrashedFilesystemEntry,
    event: MouseEvent<HTMLButtonElement>,
  ): void => {
    const ids = selection.selectedIds.has(item.entry.id)
      ? selection.selectedInOrder
      : [item.entry.id];
    if (!selection.selectedIds.has(item.entry.id)) selection.replace(ids);
    contextMenu.openFromEvent(event, [
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.RESTORE_FILES,
        FILESYSTEM_COPY.RESTORE,
        () => runBatchChange(() => gateway.restoreEntries(ids, {
          desktopPlacement: {
            targetIndex: 0,
            capacity: desktopCapacity,
          },
        })),
      ),
      contextMenuSeparator("recycle-item-separator-1"),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.PERMANENT_DELETE,
        FILESYSTEM_COPY.PERMANENT_DELETE,
        () => setDialog("delete"),
      ),
    ]);
  };

  const openTrashContextMenu = (
    event: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number },
  ): void => {
    contextMenu.openFromEvent(event, [
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.RESTORE_FILES,
        FILESYSTEM_COPY.RESTORE,
        () => runBatchChange(() => gateway.restoreEntries(
          selection.selectedInOrder,
          {
            desktopPlacement: {
              targetIndex: 0,
              capacity: desktopCapacity,
            },
          },
        )),
        selection.selectedInOrder.length === 0 || busy,
      ),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.PERMANENT_DELETE,
        FILESYSTEM_COPY.PERMANENT_DELETE,
        () => setDialog("delete"),
        selection.selectedInOrder.length === 0 || busy,
      ),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.EMPTY_RECYCLE_BIN,
        FILESYSTEM_COPY.EMPTY_RECYCLE_BIN,
        () => setDialog("empty"),
        !page || page.items.length === 0 || busy,
      ),
      contextMenuSeparator("recycle-empty-separator-1"),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.REFRESH,
        FILESYSTEM_COPY.REFRESH,
        onFilesystemChanged,
      ),
    ]);
  };

  const toolbar = (
    <div
      className="explorer-toolbar"
      aria-label={FILESYSTEM_COPY.RECYCLE_BIN_TOOLBAR}
    >
      <button
        type="button"
        disabled={selectedItems.length === 0 || busy}
        onClick={() =>
          void runBatchChange(() =>
            gateway.restoreEntries(selection.selectedInOrder, {
              desktopPlacement: {
                targetIndex: 0,
                capacity: desktopCapacity,
              },
            }),
          )
        }
      >
        {FILESYSTEM_COPY.RESTORE}
      </button>
      <button type="button" disabled={selectedItems.length === 0 || busy} onClick={() => setDialog("delete")}>
        {FILESYSTEM_COPY.PERMANENT_DELETE}
      </button>
      <button
        type="button"
        disabled={!page || page.items.length === 0 || busy}
        onClick={() => setDialog("empty")}
      >
        {FILESYSTEM_COPY.EMPTY_RECYCLE_BIN}
      </button>
    </div>
  );

  return (
    <SystemAppWindow
      {...chrome}
      appId={SYSTEM_APP_ID.RECYCLE_BIN}
      toolbar={toolbar}
      bodyClassName="explorer-window__body"
      footer={
        <footer className="explorer-statusbar">
          {selectedItems.length > 0
            ? FILESYSTEM_COPY.SELECTED_COUNT(selectedItems.length)
            : `${page?.items.length ?? 0}${FILESYSTEM_COPY.ITEM_COUNT_SUFFIX}`}
        </footer>
      }
    >
      {error ? <p className="explorer-message" role="alert">{error}</p> : null}
      {!page && !error ? <p className="explorer-message">{FILESYSTEM_COPY.BUSY}</p> : null}
      {page ? (
        <div
          ref={listRef}
          className="recycle-list"
          onPointerDown={marquee.onPointerDown}
          onPointerMove={marquee.onPointerMove}
          onPointerUp={marquee.onPointerUp}
          onPointerCancel={marquee.onPointerCancel}
          onKeyDown={(event) => {
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key.toLocaleLowerCase() === KEYBOARD_KEY.A
            ) {
              event.preventDefault();
              selection.selectAll();
            } else if (event.key === KEYBOARD_KEY.ESCAPE) {
              selection.clear();
            }
          }}
          onContextMenu={openTrashContextMenu}
        >
          <div className="recycle-list__header" aria-hidden="true">
            <span>{FILESYSTEM_COPY.NAME}</span>
            <span>{FILESYSTEM_COPY.ORIGINAL_LOCATION}</span>
            <span>{FILESYSTEM_COPY.DELETED_AT}</span>
          </div>
          {page.items.map((item) => (
            <RecycleRow
              key={item.entry.id}
              item={item}
              selected={selection.selectedIds.has(item.entry.id)}
              thumbnailUrl={(id) => gateway.thumbnailUrl(id)}
              onSelect={(event) => selection.select(item.entry.id, event)}
              onDragStart={(event) => {
                const ids = selection.dragIds(item.entry.id);
                selection.replace(ids);
                writeFilesystemDragPayload(event.dataTransfer, {
                  ids,
                  primaryId: item.entry.id,
                  source: FILESYSTEM_DRAG_SOURCE.TRASH,
                });
              }}
              onContextMenu={(event) => openTrashItemContextMenu(item, event)}
            />
          ))}
          <FilesystemSelectionMarquee bounds={marquee.bounds} />
          {page.items.length === 0 ? <p className="explorer-empty">{FILESYSTEM_COPY.EMPTY_TRASH}</p> : null}
          {page.nextOffset !== null ? (
            <button
              type="button"
              className="explorer-load-more"
              disabled={busy}
              onClick={loadMore}
            >
              {FILESYSTEM_COPY.LOAD_MORE}
            </button>
          ) : null}
        </div>
      ) : null}
      {dialog === "delete" && selectedItems.length > 0 ? (
        <ConfirmDialog
          title={FILESYSTEM_COPY.PERMANENT_DELETE}
          message={FILESYSTEM_COPY.PERMANENT_DELETE_CONFIRM}
          busy={busy}
          onConfirm={() =>
            void runBatchChange(() =>
              gateway.permanentlyDeleteEntries(selection.selectedInOrder),
            )
          }
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === "empty" ? (
        <ConfirmDialog
          title={FILESYSTEM_COPY.EMPTY_RECYCLE_BIN}
          message={FILESYSTEM_COPY.EMPTY_RECYCLE_BIN_CONFIRM}
          busy={busy}
          onConfirm={() => void runChange(() => gateway.emptyTrash())}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      <FilesystemBatchResultDialog
        result={batchResult}
        onClose={() => setBatchResult(null)}
      />
    </SystemAppWindow>
  );
}

function RecycleRow({
  item,
  selected,
  thumbnailUrl,
  onSelect,
  onDragStart,
  onContextMenu,
}: {
  readonly item: TrashedFilesystemEntry;
  readonly selected: boolean;
  readonly thumbnailUrl: (id: string) => string;
  readonly onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  readonly onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      draggable
      className={selected ? "recycle-list__row recycle-list__row--selected" : "recycle-list__row"}
      {...{ [FILESYSTEM_SELECTION_DATA_ATTRIBUTE]: item.entry.id }}
      onClick={onSelect}
      onDragStart={onDragStart}
      onContextMenu={onContextMenu}
    >
      <span>
        <FilesystemEntryIcon
          entry={item.entry}
          thumbnailUrl={thumbnailUrl}
        />
        {item.entry.name}
      </span>
      <span>{item.originalLocation}</span>
      <time dateTime={item.deletedAt}>
        {new Date(item.deletedAt).toLocaleString(KOREA_LOCALE)}
      </time>
    </button>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : FILESYSTEM_COPY.CHANGE_FAILED;
}
