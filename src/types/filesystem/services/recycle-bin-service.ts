import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type {
  FilesystemEntry,
  FilesystemTrashPage,
  RestoreFilesystemEntryInput,
} from "@/types/filesystem/filesystem";

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
  permanentlyDeleteEntries(
    ids: readonly string[],
  ): Promise<FilesystemBatchResult>;
  emptyTrash(): Promise<void>;
}
