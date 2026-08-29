import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { FilesystemMutationResult } from "@/types/filesystem/filesystem";

export interface FilesystemTrashUseCases {
  trashEntry(id: string): Promise<FilesystemMutationResult>;
  trashEntries(ids: readonly string[]): Promise<FilesystemBatchResult>;
}
