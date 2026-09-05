import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import { FILESYSTEM_DRAG_SOURCE } from "@client/constants/filesystem/filesystem";
import { readFilesystemDragPayload } from "@client/domain/filesystem/drag";
import { useFilesystemDropTarget } from "@client/hooks/filesystem/drag/use-filesystem-drop-target";
import type { TrashedFilesystemEntry } from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import {
  buildRecycleContextMenu,
  buildRecycleItemContextMenu,
} from "@client/domain/filesystem/recycle-context-menu";
import { messageFromError } from "@client/errors/error-message";
import { usePaginatedTrash } from "@client/hooks/filesystem/recycle/use-paginated-trash";
import { useFilesystemMarqueeSelection } from "@client/hooks/filesystem/use-filesystem-marquee-selection";
import { useFilesystemSelection } from "@client/hooks/filesystem/use-filesystem-selection";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import type { RecycleBinDialog, RecycleBinWindowProps } from "@client/types/filesystem/recycle-bin";

const EMPTY_ENTRY_IDS: readonly string[] = [];

type RecycleBinControllerOptions = Pick<
  RecycleBinWindowProps,
  | "gateway"
  | "desktopCapacity"
  | "filesystemRevision"
  | "onFilesystemChanged"
  | "onWidgetsClosed"
>;

export function useRecycleBinController({
  gateway,
  desktopCapacity,
  filesystemRevision,
  onFilesystemChanged,
  onWidgetsClosed,
}: RecycleBinControllerOptions) {
  const contextMenu = useXpContextMenu();
  const query = usePaginatedTrash({
    gateway,
    revision: filesystemRevision,
    errorFallback: FILESYSTEM_COPY.CHANGE_FAILED,
  });
  const [mutationBusy, setMutationBusy] = useState(false);
  const mutationPending = useRef(false);
  const dropTargets = useFilesystemDropTarget();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<RecycleBinDialog>(null);
  const [batchResult, setBatchResult] = useState<FilesystemBatchResult | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemIds = useMemo(
    () => query.page?.items.map((item) => item.entry.id) ?? EMPTY_ENTRY_IDS,
    [query.page?.items],
  );
  const selection = useFilesystemSelection(itemIds);
  const marquee = useFilesystemMarqueeSelection(
    listRef,
    selection.selectedIds,
    selection.replace,
  );
  const selectedItems = useMemo(
    () =>
      query.page?.items.filter((item) => selection.selectedIds.has(item.entry.id)) ?? [],
    [query.page?.items, selection.selectedIds],
  );
  const busy = mutationBusy || query.isLoadingMore;

  const runChange = useCallback(
    async (operation: () => Promise<unknown>): Promise<void> => {
      if (mutationPending.current) return;
      mutationPending.current = true;
      setMutationBusy(true);
      setMutationError(null);
      try {
        await operation();
        setDialog(null);
        selection.clear();
        onFilesystemChanged();
      } catch (reason) {
        setMutationError(messageFromError(reason, FILESYSTEM_COPY.CHANGE_FAILED));
      } finally {
        mutationPending.current = false;
        setMutationBusy(false);
      }
    },
    [onFilesystemChanged, selection.clear],
  );

  const runBatchChange = useCallback(
    async (operation: () => Promise<FilesystemBatchResult>): Promise<void> => {
      if (mutationPending.current) return;
      mutationPending.current = true;
      setMutationBusy(true);
      setMutationError(null);
      try {
        const result = await operation();
        onWidgetsClosed(result.closedWidgetIds);
        setDialog(null);
        setBatchResult(result.failures.length > 0 ? result : null);
        selection.replace(result.failures.map((failure) => failure.id));
        onFilesystemChanged();
      } catch (reason) {
        setMutationError(messageFromError(reason, FILESYSTEM_COPY.CHANGE_FAILED));
      } finally {
        mutationPending.current = false;
        setMutationBusy(false);
      }
    },
    [onFilesystemChanged, onWidgetsClosed, selection.replace],
  );

  const dropIntoTrash = useCallback((event: Pick<DragEvent, "dataTransfer">): void => {
    if (busy) return;
    const payload = readFilesystemDragPayload(event.dataTransfer);
    if (!payload || payload.source !== FILESYSTEM_DRAG_SOURCE.ACTIVE) {
      setMutationError(FILESYSTEM_COPY.DROP_NOT_ALLOWED);
      return;
    }
    void runBatchChange(() => gateway.trashEntries(payload.ids));
  }, [busy, gateway, runBatchChange]);

  const restore = useCallback(
    (ids: readonly string[]): Promise<void> =>
      runBatchChange(() =>
        gateway.restoreEntries(ids, {
          desktopPlacement: { targetIndex: 0, capacity: desktopCapacity },
        }),
      ),
    [desktopCapacity, gateway, runBatchChange],
  );

  const openItemContextMenu = useCallback(
    (item: TrashedFilesystemEntry, event: ContextMenuEvent): void => {
      const ids = selection.selectedIds.has(item.entry.id)
        ? selection.selectedInOrder
        : [item.entry.id];
      if (!selection.selectedIds.has(item.entry.id)) selection.replace(ids);
      contextMenu.openFromEvent(
        event,
        buildRecycleItemContextMenu({
          restore: () => restore(ids),
          permanentlyDelete: () => setDialog("delete"),
        }),
      );
    },
    [contextMenu, restore, selection],
  );

  const openContextMenu = useCallback(
    (event: ContextMenuEvent): void => {
      contextMenu.openFromEvent(
        event,
        buildRecycleContextMenu(
          {
            hasSelection: selection.selectedInOrder.length > 0,
            hasItems: Boolean(query.page?.items.length),
            busy,
          },
          {
            restore: () => restore(selection.selectedInOrder),
            permanentlyDelete: () => setDialog("delete"),
            empty: () => setDialog("empty"),
            refresh: onFilesystemChanged,
          },
        ),
      );
    },
    [busy, contextMenu, onFilesystemChanged, query.page?.items.length, restore, selection.selectedInOrder],
  );

  return {
    page: query.page,
    error: mutationError ?? query.error,
    busy,
    dropTargets,
    dropIntoTrash,
    dialog,
    batchResult,
    listRef,
    selection,
    marquee,
    selectedItems,
    reload: query.reload,
    loadMore: query.loadMore,
    setDialog,
    setBatchResult,
    runChange,
    runBatchChange,
    restore,
    openItemContextMenu,
    openContextMenu,
  } as const;
}

interface ContextMenuEvent {
  preventDefault: () => void;
  stopPropagation: () => void;
  clientX: number;
  clientY: number;
}
