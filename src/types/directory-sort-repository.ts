import type { FilesystemDirectorySort } from "./filesystem";

export interface DirectorySortRepository {
  find(directoryId: string): Promise<FilesystemDirectorySort | null>;
  save(directoryId: string, sort: FilesystemDirectorySort): Promise<void>;
}
