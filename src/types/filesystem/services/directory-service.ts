import type {
  DesktopPlacement,
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
} from "@/types/filesystem/filesystem";

export interface FilesystemDirectoryUseCases {
  listDirectory(
    parentId: string | null,
    offset: number,
    limit: number,
  ): Promise<FilesystemDirectoryPage>;
  updateDirectorySort(
    directoryId: string,
    sort: FilesystemDirectorySort,
  ): Promise<FilesystemDirectorySort>;
  createDirectory(
    parentId: string | null,
    name: string,
    desktopPlacement?: DesktopPlacement,
  ): Promise<FilesystemDirectoryEntry>;
}
