import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useCallback, useMemo, useRef, useState } from "react";
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
>;

export function useRecycleBinController({
  gateway,
  desktopCapacity,
  filesystemRevision,
  onFilesystemChanged,
}: RecycleBinControllerOptions) {
  const contextMenu = useXpContextMenu();
  const query = usePaginatedTrash({
    gateway,
    revision: filesystemRevision,
    errorFallback: FILESYSTEM_COPY.CHANGE_FAILED,
  });
  const [mutationBusy, setMutationBusy] = useState(false);
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
        setMutationBusy(false);
      }
    },
    [onFilesystemChanged, selection.clear],
  );

  const runBatchChange = useCallback(
    async (operation: () => Promise<FilesystemBatchResult>): Promise<void> => {
      setMutationBusy(true);
      setMutationError(null);
      try {
        const result = await operation();
        setDialog(null);
        setBatchResult(result.failures.length > 0 ? result : null);
        selection.replace(result.failures.map((failure) => failure.id));
        onFilesystemChanged();
      } catch (reason) {
        setMutationError(messageFromError(reason, FILESYSTEM_COPY.CHANGE_FAILED));
      } finally {
        setMutationBusy(false);
      }
    },
    [onFilesystemChanged, selection.replace],
  );

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
