import type {
  FilesystemDirectoryDetails,
} from "@/types/filesystem/directory-details";
import type {
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
} from "@/types/filesystem/filesystem";

export interface FilesystemDirectoryGateway {
  listDirectory(
    parentId?: string,
    offset?: number,
  ): Promise<FilesystemDirectoryPage>;
  updateDirectorySort(
    directoryId: string,
    sort: FilesystemDirectorySort,
  ): Promise<FilesystemDirectorySort>;
  getDirectoryDetails(directoryId: string): Promise<FilesystemDirectoryDetails>;
}
