import { useCallback, useEffect, useRef, useState } from "react";
import { usePaginatedDirectory } from "@client/hooks/filesystem/directory/use-paginated-directory";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";

interface DirectoryNavigationOptions {
  readonly gateway: Pick<FilesystemDirectoryGateway, "listDirectory">;
  readonly initialDirectoryId: string;
  readonly revision?: number;
  readonly errorFallback: string;
  readonly onDirectoryLoaded?: (
    directoryId: string,
    title: string,
  ) => void;
}

export function useDirectoryNavigation({
  gateway,
  initialDirectoryId,
  revision = 0,
  errorFallback,
  onDirectoryLoaded,
}: DirectoryNavigationOptions) {
  const [directoryId, setDirectoryId] = useState(initialDirectoryId);
  const [history, setHistory] = useState<readonly string[]>([]);
  const onDirectoryLoadedRef = useRef(onDirectoryLoaded);
  const query = usePaginatedDirectory({
    gateway,
    directoryId,
    revision,
    errorFallback,
  });
  const page = query.page;

  useEffect(() => {
    onDirectoryLoadedRef.current = onDirectoryLoaded;
  }, [onDirectoryLoaded]);

  useEffect(() => {
    if (page) {
      onDirectoryLoadedRef.current?.(page.directory.id, page.directory.name);
    }
  }, [page?.directory.id, page?.directory.name]);

  const navigate = useCallback(
    (nextDirectoryId: string): void => {
      if (nextDirectoryId === page?.directory.id) return;
      if (page?.directory.id) {
        setHistory((current) => [...current, page.directory.id]);
      }
      setDirectoryId(nextDirectoryId);
    },
    [page?.directory.id],
  );

  const navigateDirect = useCallback((nextDirectoryId: string): void => {
    setDirectoryId(nextDirectoryId);
  }, []);

  const navigateBack = useCallback((): void => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setDirectoryId(previous);
  }, [history]);

  const navigateUp = useCallback((): void => {
    const parent = page?.breadcrumbs.at(-2);
    if (parent) navigate(parent.id);
  }, [navigate, page?.breadcrumbs]);

  return {
    ...query,
    directoryId,
    history,
    navigate,
    navigateDirect,
    navigateBack,
    navigateUp,
  } as const;
}
