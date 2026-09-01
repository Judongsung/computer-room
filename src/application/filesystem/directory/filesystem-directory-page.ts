import {
  toPublicDirectory,
  toPublicEntry,
} from "@/application/filesystem/filesystem-entry-mapper";
import type {
  FilesystemBreadcrumb,
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
  FilesystemEntryRecord,
} from "@/types/filesystem/filesystem";

interface FilesystemDirectoryPageInput {
  readonly directory: FilesystemEntryRecord;
  readonly breadcrumbs: readonly FilesystemBreadcrumb[];
  readonly entries: readonly FilesystemEntryRecord[];
  readonly offset: number;
  readonly limit: number;
  readonly sort: FilesystemDirectorySort;
}

export function assembleFilesystemDirectoryPage({
  directory,
  breadcrumbs,
  entries,
  offset,
  limit,
  sort,
}: FilesystemDirectoryPageInput): FilesystemDirectoryPage {
  const hasMore = entries.length > limit;
  return {
    directory: toPublicDirectory(directory),
    breadcrumbs,
    items: entries.slice(0, limit).map(toPublicEntry),
    nextOffset: hasMore ? offset + limit : null,
    sort,
  };
}
