import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemEntry,
  FilesystemTrashPage,
  FilesystemFileEntry,
  UpdateFilesystemEntryInput,
} from "../../types/filesystem";

export interface FilesystemGateway {
  listDirectory(parentId?: string, offset?: number): Promise<FilesystemDirectoryPage>;
  createDirectory(parentId: string, name: string): Promise<FilesystemDirectoryEntry>;
  uploadFile(parentId: string, file: File): Promise<FilesystemFileEntry>;
  updateEntry(
    id: string,
    input: UpdateFilesystemEntryInput,
  ): Promise<FilesystemEntry>;
  trashEntry(id: string): Promise<void>;
  downloadUrl(id: string): string;
  listTrash(offset?: number): Promise<FilesystemTrashPage>;
  restoreEntry(id: string): Promise<FilesystemEntry>;
  permanentlyDeleteEntry(id: string): Promise<void>;
  emptyTrash(): Promise<void>;
}

export interface FilesystemWindowSyncProps {
  readonly filesystemRevision: number;
  readonly onFilesystemChanged: () => void;
}
