import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
  FilesystemEntry,
  FilesystemTrashPage,
  FilesystemFileEntry,
  FilesystemMutationResult,
  MoveFilesystemEntryInput,
  RestoreFilesystemEntryInput,
  DesktopPlacement,
  UpdateFilesystemEntryInput,
} from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { FilesystemDownloadManifest } from "@/types/filesystem/download";
import type { FilesystemDirectoryDetails } from "@/types/filesystem/directory-details";
import type { FILESYSTEM_DRAG_SOURCE } from "@client/constants/filesystem/filesystem";
import type {
  DesktopDimensions,
  ManagedDesktopWindowState,
  WindowBounds,
} from "@client/types/desktop/desktop";

export interface FilesystemGateway {
  listDirectory(parentId?: string, offset?: number): Promise<FilesystemDirectoryPage>;
  updateDirectorySort(
    directoryId: string,
    sort: FilesystemDirectorySort,
  ): Promise<FilesystemDirectorySort>;
  getDirectoryDetails(directoryId: string): Promise<FilesystemDirectoryDetails>;
  createDirectory(
    parentId: string,
    name: string,
    desktopPlacement?: DesktopPlacement,
  ): Promise<FilesystemDirectoryEntry>;
  uploadFile(
    parentId: string,
    file: File,
    desktopPlacement?: DesktopPlacement,
  ): Promise<FilesystemFileEntry>;
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
  createDownloadManifest(
    ids: readonly string[],
  ): Promise<FilesystemDownloadManifest>;
  downloadUrl(id: string): string;
  contentUrl(id: string): string;
  thumbnailUrl(id: string): string;
  listTrash(offset?: number): Promise<FilesystemTrashPage>;
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

export type FilesystemDownloadGateway = Pick<
  FilesystemGateway,
  "createDownloadManifest" | "downloadUrl"
>;

export interface FilesystemWindowSyncProps {
  readonly filesystemRevision: number;
  readonly onFilesystemChanged: () => void;
}

export type DesktopFilesystemDialog =
  | { readonly kind: "create" }
  | { readonly kind: "rename"; readonly entries: readonly FilesystemEntry[] }
  | { readonly kind: "move"; readonly entries: readonly FilesystemEntry[] }
  | null;

export interface DragFilesystemEntryPayload {
  readonly ids: readonly string[];
  readonly primaryId: string;
  readonly source:
    (typeof FILESYSTEM_DRAG_SOURCE)[keyof typeof FILESYSTEM_DRAG_SOURCE];
}

export interface ExplorerWindowOpenRequest {
  readonly directoryId: string;
  readonly title: string;
  readonly iconPath: string;
}

export interface ExplorerWindowState extends ManagedDesktopWindowState {
  readonly id: string;
  readonly directoryId: string;
  readonly title: string;
  readonly iconPath: string;
}

export interface ExplorerWindowController {
  readonly windows: readonly ExplorerWindowState[];
  open(request: ExplorerWindowOpenRequest, desktop: DesktopDimensions): string;
  close(id: string): void;
  minimize(id: string): void;
  restore(id: string): void;
  toggleMaximize(id: string): void;
  commitBounds(id: string, bounds: WindowBounds): void;
  changeDirectory(id: string, directoryId: string, title: string): void;
}
