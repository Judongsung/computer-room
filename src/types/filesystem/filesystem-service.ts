import type {
  DesktopPlacement,
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
  FilesystemEntry,
  FilesystemMutationResult,
  FilesystemTrashPage,
  MoveFilesystemEntryInput,
  RestoreFilesystemEntryInput,
  UpdateFilesystemEntryInput,
} from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { FilesystemArchiveSourceManifest } from "@/types/filesystem/download";

export interface FilesystemUseCases {
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
  updateEntry(
    id: string,
    input: UpdateFilesystemEntryInput,
  ): Promise<FilesystemEntry>;
  moveEntry(
    id: string,
    input: MoveFilesystemEntryInput,
  ): Promise<FilesystemEntry>;
  moveEntries(
    ids: readonly string[],
    input: MoveFilesystemEntryInput,
  ): Promise<FilesystemBatchResult>;
  trashEntry(id: string): Promise<FilesystemMutationResult>;
  trashEntries(ids: readonly string[]): Promise<FilesystemBatchResult>;
}

export interface FilesystemDownloadManifestUseCases {
  createManifest(ids: readonly string[]): Promise<FilesystemArchiveSourceManifest>;
}

export interface FilesystemPathUseCases {
  ensureDirectory(
    parentId: string,
    name: string,
  ): Promise<FilesystemDirectoryEntry>;
}

export interface RecycleBinUseCases {
  listTrash(offset: number, limit: number): Promise<FilesystemTrashPage>;
  restoreEntry(
    id: string,
    input?: RestoreFilesystemEntryInput,
  ): Promise<FilesystemEntry>;
  restoreEntries(
    ids: readonly string[],
    input?: RestoreFilesystemEntryInput,
  ): Promise<FilesystemBatchResult>;
  permanentlyDeleteEntry(id: string): Promise<void>;
  permanentlyDeleteEntries(ids: readonly string[]): Promise<FilesystemBatchResult>;
  emptyTrash(): Promise<void>;
}
