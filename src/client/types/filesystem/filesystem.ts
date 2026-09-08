import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { FILESYSTEM_DRAG_SOURCE } from "@client/constants/filesystem/filesystem";
import type { DesktopDimensions, ManagedDesktopWindowState, WindowBounds } from "@client/types/desktop/window";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";
import type { FilesystemEntryGateway } from "@client/types/filesystem/ports/entry";
import type { FilesystemRecycleBinGateway } from "@client/types/filesystem/ports/recycle-bin";
import type { FilesystemTransferGateway } from "@client/types/filesystem/ports/transfer";

export interface FilesystemGateway
  extends FilesystemDirectoryGateway,
    FilesystemEntryGateway,
    FilesystemTransferGateway,
    FilesystemRecycleBinGateway {}

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
