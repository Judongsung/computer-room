import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { FILESYSTEM_DRAG_SOURCE } from "@client/constants/filesystem/filesystem";
import { readFilesystemDragPayload } from "@client/domain/filesystem/drag";
import { useFilesystemDropTarget } from "@client/hooks/filesystem/drag/use-filesystem-drop-target";
import type { TrashedFilesystemEntry } from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import {
  buildRecycleContextMenu,
  buildRecycleItemContextMenu,
} from "@client/domain/filesystem/recycle-context-menu";
import { useFilesystemMutation } from "@client/hooks/filesystem/commands/use-filesystem-mutation";
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
  const mutation = useFilesystemMutation(gateway);
  const { run: runMutation, setError: setMutationError } = mutation;
  const dropTargets = useFilesystemDropTarget();
  const [dialog, setDialog] = useState<RecycleBinDialog>(null);
  const [batchResult, setBatchResult] = useState<FilesystemBatchResult | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemIds = useMemo(
    () => query.page?.items.map((item) => item.entry.id) ?? EMPTY_ENTRY_IDS,
    [query.page?.items],
  );
  const selection = useFilesystemSelection(itemIds);
  const { clear: clearSelection, replace: replaceSelection } = selection;
  const marquee = useFilesystemMarqueeSelection(
    listRef,
    selection.selectedIds,
    replaceSelection,
  );
  const selectedItems = useMemo(
    () =>
      query.page?.items.filter((item) => selection.selectedIds.has(item.entry.id)) ?? [],
    [query.page?.items, selection.selectedIds],
  );
  const restoreBlocked = selectedItems.some((item) => item.deletionStartedAt !== null);
  const busy = mutation.busy || query.isLoadingMore || query.isRefreshing;
  const latest = useRef({ onFilesystemChanged, onWidgetsClosed });
  useLayoutEffect(() => {
    latest.current = { onFilesystemChanged, onWidgetsClosed };
  });

  const runChange = useCallback(
    async (operation: () => Promise<unknown>): Promise<void> => {
      const outcome = await runMutation(operation, () => {
        setDialog(null);
        clearSelection();
        latest.current.onFilesystemChanged();
      });
      if (outcome.status === "failed") latest.current.onFilesystemChanged();
    },
    [runMutation, clearSelection],
  );

  const runBatchChange = useCallback(
    async (operation: () => Promise<FilesystemBatchResult>, refreshOnFailure = false): Promise<void> => {
      const outcome = await runMutation(operation, (result) => {
        latest.current.onWidgetsClosed(result.closedWidgetIds);
        setDialog(null);
        setBatchResult(result.failures.length > 0 ? result : null);
        replaceSelection(result.failures.map((failure) => failure.id));
        latest.current.onFilesystemChanged();
      });
      if (refreshOnFailure && outcome.status === "failed") latest.current.onFilesystemChanged();
    },
    [runMutation, replaceSelection],
  );

  const dropIntoTrash = useCallback((event: Pick<DragEvent, "dataTransfer">): void => {
    if (busy) return;
    const payload = readFilesystemDragPayload(event.dataTransfer);
    if (!payload || payload.source !== FILESYSTEM_DRAG_SOURCE.ACTIVE) {
      setMutationError(FILESYSTEM_COPY.DROP_NOT_ALLOWED);
      return;
    }
    void runBatchChange(() => gateway.trashEntries(payload.ids));
  }, [busy, gateway, setMutationError, runBatchChange]);

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
      if (!selection.selectedIds.has(item.entry.id)) replaceSelection(ids);
      contextMenu.openFromEvent(
        event,
        buildRecycleItemContextMenu(
          {
            restore: () => restore(ids),
            permanentlyDelete: () => setDialog("delete"),
          },
          busy || (selection.selectedIds.has(item.entry.id)
            ? restoreBlocked
            : item.deletionStartedAt !== null),
        ),
      );
    },
    [busy, contextMenu, replaceSelection, restore, restoreBlocked, selection],
  );

  const openContextMenu = useCallback(
    (event: ContextMenuEvent): void => {
      contextMenu.openFromEvent(
        event,
        buildRecycleContextMenu(
          {
            hasSelection: selection.selectedInOrder.length > 0,
            restoreBlocked,
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
    [busy, restoreBlocked, contextMenu, onFilesystemChanged, query.page?.items.length, restore, selection.selectedInOrder],
  );

  return {
    page: query.page,
    error: mutation.error ?? query.error,
    busy,
    dropTargets,
    dropIntoTrash,
    dialog,
    batchResult,
    listRef,
    selection,
    marquee,
    selectedItems,
    restoreBlocked,
    reload: query.reload,
    retry: query.retry,
    queryError: query.error,
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
