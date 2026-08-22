import type {
  DesktopPlacement,
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemEntry,
  FilesystemMutationResult,
  FilesystemTrashPage,
  MoveFilesystemEntryInput,
  RestoreFilesystemEntryInput,
  UpdateFilesystemEntryInput,
} from "./filesystem";

export interface FilesystemUseCases {
  listDirectory(
    parentId: string | null,
    offset: number,
    limit: number,
  ): Promise<FilesystemDirectoryPage>;
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
  trashEntry(id: string): Promise<FilesystemMutationResult>;
}

export interface RecycleBinUseCases {
  listTrash(offset: number, limit: number): Promise<FilesystemTrashPage>;
  restoreEntry(
    id: string,
    input?: RestoreFilesystemEntryInput,
  ): Promise<FilesystemEntry>;
  permanentlyDeleteEntry(id: string): Promise<void>;
  emptyTrash(): Promise<void>;
}
