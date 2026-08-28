import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FilesystemDirectoryPage,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";
import { messageFromError } from "@client/errors/error-message";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";

const INCLUDE_ALL_ENTRIES = (
  _entry: FilesystemEntry,
): _entry is FilesystemEntry => true;

type FilteredDirectoryPage<TEntry extends FilesystemEntry> = Omit<
  FilesystemDirectoryPage,
  "items"
> & {
  readonly items: readonly TEntry[];
};

interface PaginatedDirectoryOptions<TEntry extends FilesystemEntry> {
  readonly gateway: Pick<FilesystemDirectoryGateway, "listDirectory">;
  readonly directoryId: string;
  readonly revision?: number;
  readonly errorFallback: string;
  readonly includeEntry?: (entry: FilesystemEntry) => entry is TEntry;
}

export function usePaginatedDirectory<
  TEntry extends FilesystemEntry = FilesystemEntry,
>({
  gateway,
  directoryId,
  revision = 0,
  errorFallback,
  includeEntry = INCLUDE_ALL_ENTRIES as (
    entry: FilesystemEntry,
  ) => entry is TEntry,
}: PaginatedDirectoryOptions<TEntry>) {
  const [page, setPage] = useState<FilteredDirectoryPage<TEntry> | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const loadingMore = useRef(false);

  const reload = useCallback(async (): Promise<void> => {
    const requestId = ++requestSequence.current;
    loadingMore.current = false;
    setPage(null);
    setIsInitialLoading(true);
    setIsLoadingMore(false);
    setError(null);
    try {
      const next = await gateway.listDirectory(directoryId);
      if (requestSequence.current !== requestId) return;
      setPage(filterPage(next, includeEntry));
    } catch (reason) {
      if (requestSequence.current !== requestId) return;
      setError(messageFromError(reason, errorFallback));
    } finally {
      if (requestSequence.current === requestId) {
        setIsInitialLoading(false);
      }
    }
  }, [directoryId, errorFallback, gateway, includeEntry]);

  useEffect(() => {
    void reload();
    return () => {
      requestSequence.current += 1;
      loadingMore.current = false;
    };
  }, [reload, revision]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!page || page.nextOffset === null || loadingMore.current) return;
    const requestId = requestSequence.current;
    const expectedDirectoryId = page.directory.id;
    loadingMore.current = true;
    setIsLoadingMore(true);
    setError(null);
    try {
      const next = await gateway.listDirectory(
        expectedDirectoryId,
        page.nextOffset,
      );
      if (requestSequence.current !== requestId) return;
      const filtered = filterPage(next, includeEntry);
      setPage((current) =>
        current?.directory.id === expectedDirectoryId &&
        filtered.directory.id === expectedDirectoryId
          ? {
              ...filtered,
              items: [...current.items, ...filtered.items],
            }
          : current,
      );
    } catch (reason) {
      if (requestSequence.current === requestId) {
        setError(messageFromError(reason, errorFallback));
      }
    } finally {
      if (requestSequence.current === requestId) {
        loadingMore.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [errorFallback, gateway, includeEntry, page]);

  return {
    page,
    isInitialLoading,
    isLoadingMore,
    error,
    reload,
    loadMore,
  } as const;
}

function filterPage<TEntry extends FilesystemEntry>(
  page: FilesystemDirectoryPage,
  includeEntry: (entry: FilesystemEntry) => entry is TEntry,
): FilteredDirectoryPage<TEntry> {
  return {
    ...page,
    items: page.items.filter(includeEntry),
  };
}
