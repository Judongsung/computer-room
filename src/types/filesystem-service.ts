import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemEntry,
  FilesystemTrashPage,
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
  ): Promise<FilesystemDirectoryEntry>;
  updateEntry(
    id: string,
    input: UpdateFilesystemEntryInput,
  ): Promise<FilesystemEntry>;
  trashEntry(id: string): Promise<void>;
}

export interface RecycleBinUseCases {
  listTrash(offset: number, limit: number): Promise<FilesystemTrashPage>;
  restoreEntry(id: string): Promise<FilesystemEntry>;
  permanentlyDeleteEntry(id: string): Promise<void>;
  emptyTrash(): Promise<void>;
}

