import { useCallback } from "react";
import type { FilesystemTrashPage } from "@/types/filesystem/filesystem";
import { useFilesystemPages, mergeFilesystemItems } from "@client/hooks/filesystem/use-filesystem-pages";
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
  const read = useCallback((offset: number) => gateway.listTrash(offset), [gateway]);
  return useFilesystemPages(read, mergePages, revision, errorFallback);
}

function mergePages(
  previous: FilesystemTrashPage | null,
  next: FilesystemTrashPage,
): FilesystemTrashPage {
  return {
    ...next,
    items: mergeFilesystemItems(previous?.items ?? [], next.items, (item) => item.entry.id),
  };
}
