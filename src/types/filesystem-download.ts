import type { FILESYSTEM_ENTRY_KIND } from "../constants/filesystem";

export interface FilesystemArchiveDirectorySource {
  readonly kind: typeof FILESYSTEM_ENTRY_KIND.DIRECTORY;
  readonly path: string;
  readonly updatedAt: string;
}

export interface FilesystemArchiveFileSource {
  readonly kind: typeof FILESYSTEM_ENTRY_KIND.FILE;
  readonly id: string;
  readonly path: string;
  readonly size: number;
  readonly updatedAt: string;
}

export type FilesystemArchiveSource =
  | FilesystemArchiveDirectorySource
  | FilesystemArchiveFileSource;

export interface FilesystemArchiveSourceManifest {
  readonly archiveName: string;
  readonly entries: readonly FilesystemArchiveSource[];
  readonly totalFileCount: number;
  readonly totalBytes: number;
  readonly skippedWidgetIds: readonly string[];
}

export type FilesystemDownloadManifestDirectory =
  FilesystemArchiveDirectorySource;

export interface FilesystemDownloadManifestFile
  extends FilesystemArchiveFileSource {
  readonly downloadUrl: string;
}

export type FilesystemDownloadManifestEntry =
  | FilesystemDownloadManifestDirectory
  | FilesystemDownloadManifestFile;

export interface FilesystemDownloadManifest
  extends Omit<FilesystemArchiveSourceManifest, "entries"> {
  readonly entries: readonly FilesystemDownloadManifestEntry[];
}
