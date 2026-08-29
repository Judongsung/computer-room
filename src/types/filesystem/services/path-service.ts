import type { FilesystemDirectoryEntry } from "@/types/filesystem/filesystem";

export interface FilesystemPathUseCases {
  ensureDirectory(
    parentId: string,
    name: string,
  ): Promise<FilesystemDirectoryEntry>;
}
