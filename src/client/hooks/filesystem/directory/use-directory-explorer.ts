import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useCallback } from "react";
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
}

export function useDirectoryExplorer({
  gateway,
  initialDirectoryId,
  revision,
  windowId,
  onDirectoryChanged,
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

  return navigation;
}
