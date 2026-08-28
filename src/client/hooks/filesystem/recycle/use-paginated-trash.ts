import { useCallback, useEffect, useRef, useState } from "react";
import type { FilesystemTrashPage } from "@/types/filesystem/filesystem";
import { messageFromError } from "@client/errors/error-message";
import type { FilesystemRecycleBinGateway } from "@client/types/filesystem/ports/recycle-bin";

interface PaginatedTrashOptions {
  readonly gateway: Pick<FilesystemRecycleBinGateway, "listTrash">;
  readonly revision?: number;
  readonly errorFallback: string;
}

export function usePaginatedTrash({
  gateway,
  revision = 0,
  errorFallback,
}: PaginatedTrashOptions) {
  const [page, setPage] = useState<FilesystemTrashPage | null>(null);
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
      const next = await gateway.listTrash();
      if (requestSequence.current === requestId) setPage(next);
    } catch (reason) {
      if (requestSequence.current === requestId) {
        setError(messageFromError(reason, errorFallback));
      }
    } finally {
      if (requestSequence.current === requestId) {
        setIsInitialLoading(false);
      }
    }
  }, [errorFallback, gateway]);

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
    loadingMore.current = true;
    setIsLoadingMore(true);
    setError(null);
    try {
      const next = await gateway.listTrash(page.nextOffset);
      if (requestSequence.current !== requestId) return;
      setPage((current) =>
        current
          ? {
              items: [...current.items, ...next.items],
              nextOffset: next.nextOffset,
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
  }, [errorFallback, gateway, page]);

  return {
    page,
    isInitialLoading,
    isLoadingMore,
    error,
    reload,
    loadMore,
  } as const;
}
