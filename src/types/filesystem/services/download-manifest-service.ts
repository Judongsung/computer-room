import type { FilesystemArchiveSourceManifest } from "@/types/filesystem/download";

export interface FilesystemDownloadManifestUseCases {
  createManifest(
    ids: readonly string[],
  ): Promise<FilesystemArchiveSourceManifest>;
}
