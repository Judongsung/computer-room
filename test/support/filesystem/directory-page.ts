import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import type { FilesystemDirectoryPage, FilesystemEntry } from "@/types/filesystem/filesystem";

export function directoryPage(
  items: readonly FilesystemEntry[],
  nextOffset: number | null = null,
  directoryId: string = FILESYSTEM_ROOT_ID.DESKTOP,
): FilesystemDirectoryPage {
  return {
    directory: {
      id: directoryId, parentId: null, kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name: directoryId, createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(), desktopOrder: null,
    },
    breadcrumbs: [{ id: directoryId, name: directoryId }],
    items,
    nextOffset,
    sort: DEFAULT_FILESYSTEM_DIRECTORY_SORT,
  };
}
