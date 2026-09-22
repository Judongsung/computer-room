import type {
  DesktopPlacement,
  FilesystemDirectoryEntry,
  FilesystemEntry,
  FilesystemMutationResult,
  MoveFilesystemEntryInput,
  UpdateFilesystemEntryInput,
} from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";

import type { FilesystemShortcutUseCases } from "@/types/filesystem/services/shortcut-service";

export interface FilesystemEntryGateway extends FilesystemShortcutUseCases {
  createDirectory(
    parentId: string,
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
