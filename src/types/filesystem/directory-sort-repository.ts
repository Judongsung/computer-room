import type { FilesystemDirectorySort } from "@/types/filesystem/filesystem";

export interface DirectorySortRepository {
  find(directoryId: string): Promise<FilesystemDirectorySort | null>;
  save(directoryId: string, sort: FilesystemDirectorySort): Promise<void>;
}
