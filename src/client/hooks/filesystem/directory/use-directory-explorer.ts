import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useCallback } from "react";
import type { FilesystemDirectorySort } from "@/types/filesystem/filesystem";
import { useDirectoryNavigation } from "@client/hooks/filesystem/directory/use-directory-navigation";
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
  const handleDirectoryLoaded = useCallback(
    (directoryId: string, title: string): void => {
      onDirectoryChanged(windowId, directoryId, title);
    },
    [onDirectoryChanged, windowId],
  );
  const navigation = useDirectoryNavigation({
    gateway,
    initialDirectoryId,
    revision,
    errorFallback: FILESYSTEM_COPY.LOAD_FAILED,
    onDirectoryLoaded: handleDirectoryLoaded,
  });

  const changeSort = useCallback(
    async (sort: FilesystemDirectorySort): Promise<void> => {
      const currentDirectoryId = navigation.page?.directory.id;
      if (!currentDirectoryId) return;
      await gateway.updateDirectorySort(currentDirectoryId, sort);
      onFilesystemChanged();
    },
    [gateway, navigation.page?.directory.id, onFilesystemChanged],
  );

  return {
    ...navigation,
    changeSort,
  } as const;
}
