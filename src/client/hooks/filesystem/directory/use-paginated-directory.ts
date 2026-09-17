import { useCallback, useMemo } from "react";
import type {
  FilesystemDirectoryPage,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";
import { useFilesystemPages, mergeFilesystemItems } from "@client/hooks/filesystem/use-filesystem-pages";
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
  const read = useCallback(
    (offset: number) => gateway.listDirectory(directoryId, offset),
    [gateway, directoryId],
  );
  const query = useFilesystemPages(read, mergePages, revision, errorFallback);
  const page = useMemo(
    () => query.page ? filterPage(query.page, includeEntry) : null,
    [query.page, includeEntry],
  );
  return { ...query, page };
}

function mergePages(
  previous: FilesystemDirectoryPage | null,
  next: FilesystemDirectoryPage,
): FilesystemDirectoryPage {
  return {
    ...next,
    items: mergeFilesystemItems(previous?.items ?? [], next.items, (entry) => entry.id),
  };
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
