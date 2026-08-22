import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemEntry,
  FilesystemTrashPage,
  FilesystemFileEntry,
  FilesystemMutationResult,
  MoveFilesystemEntryInput,
  RestoreFilesystemEntryInput,
  DesktopPlacement,
  UpdateFilesystemEntryInput,
} from "../../types/filesystem";
import type { FILESYSTEM_DRAG_SOURCE } from "../constants/filesystem";
import type {
  DesktopDimensions,
  ManagedDesktopWindowState,
  WindowBounds,
} from "./desktop";

export interface FilesystemGateway {
  listDirectory(parentId?: string, offset?: number): Promise<FilesystemDirectoryPage>;
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
  trashEntry(id: string): Promise<FilesystemMutationResult>;
  downloadUrl(id: string): string;
  contentUrl(id: string): string;
  listTrash(offset?: number): Promise<FilesystemTrashPage>;
  restoreEntry(
    id: string,
    input?: RestoreFilesystemEntryInput,
  ): Promise<FilesystemEntry>;
  permanentlyDeleteEntry(id: string): Promise<void>;
  emptyTrash(): Promise<void>;
}

export interface FilesystemWindowSyncProps {
  readonly filesystemRevision: number;
  readonly onFilesystemChanged: () => void;
}

export interface DragFilesystemEntryPayload {
  readonly id: string;
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
