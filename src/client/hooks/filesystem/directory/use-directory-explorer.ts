import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useCallback, useEffect, useState } from "react";
import type { FilesystemDirectorySort } from "@/types/filesystem/filesystem";
import { usePaginatedDirectory } from "@client/hooks/filesystem/directory/use-paginated-directory";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";

interface DirectoryExplorerOptions {
  readonly gateway: FilesystemDirectoryGateway;
  readonly initialDirectoryId: string;
  readonly revision: number;
  readonly windowId: string;
  readonly onDirectoryChanged: (
    windowId: string,
    directoryId: string,
    title: string,
  ) => void;
  readonly onFilesystemChanged: () => void;
}

export function useDirectoryExplorer({
  gateway,
  initialDirectoryId,
  revision,
  windowId,
  onDirectoryChanged,
  onFilesystemChanged,
}: DirectoryExplorerOptions) {
  const [directoryId, setDirectoryId] = useState(initialDirectoryId);
  const [history, setHistory] = useState<readonly string[]>([]);
  const query = usePaginatedDirectory({
    gateway,
    directoryId,
    revision,
    errorFallback: FILESYSTEM_COPY.LOAD_FAILED,
  });
  const page = query.page;

  useEffect(() => {
    if (!page) return;
    onDirectoryChanged(windowId, page.directory.id, page.directory.name);
  }, [onDirectoryChanged, page?.directory.id, page?.directory.name, windowId]);

  const navigate = useCallback(
    (nextDirectoryId: string): void => {
      if (page?.directory.id) {
        setHistory((current) => [...current, page.directory.id]);
      }
      setDirectoryId(nextDirectoryId);
    },
    [page?.directory.id],
  );

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

  const changeSort = useCallback(
    async (sort: FilesystemDirectorySort): Promise<void> => {
      const currentDirectoryId = page?.directory.id;
      if (!currentDirectoryId) return;
      await gateway.updateDirectorySort(currentDirectoryId, sort);
      onFilesystemChanged();
    },
    [gateway, onFilesystemChanged, page?.directory.id],
  );

  return {
    ...query,
    directoryId,
    history,
    navigate,
    navigateDirect: setDirectoryId,
    navigateBack,
    navigateUp,
    changeSort,
  } as const;
}
