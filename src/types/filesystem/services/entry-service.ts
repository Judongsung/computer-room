import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type {
  FilesystemEntry,
  MoveFilesystemEntryInput,
  UpdateFilesystemEntryInput,
} from "@/types/filesystem/filesystem";

export interface FilesystemEntryUseCases {
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
}
