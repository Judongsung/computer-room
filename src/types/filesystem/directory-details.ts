import type {
  FilesystemBreadcrumb,
  FilesystemDirectoryEntry,
} from "@/types/filesystem/filesystem";

export interface FilesystemDirectoryStatistics {
  readonly totalBytes: number;
  readonly fileCount: number;
  readonly directoryCount: number;
  readonly widgetCount: number;
}

export interface FilesystemDirectoryDetails
  extends FilesystemDirectoryStatistics {
  readonly directory: FilesystemDirectoryEntry;
  readonly breadcrumbs: readonly FilesystemBreadcrumb[];
}

export interface DirectoryDetailsRepository {
  readStatistics(directoryId: string): Promise<FilesystemDirectoryStatistics>;
}

export interface DirectoryDetailsUseCases {
  getDetails(directoryId: string): Promise<FilesystemDirectoryDetails>;
}
