import type { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";

export interface LocalUploadFileNode {
  readonly kind: typeof FILESYSTEM_ENTRY_KIND.FILE;
  readonly name: string;
  readonly file: File;
}

export interface LocalUploadDirectoryNode {
  readonly kind: typeof FILESYSTEM_ENTRY_KIND.DIRECTORY;
  readonly name: string;
  readonly children: readonly LocalUploadNode[];
}

export type LocalUploadNode = LocalUploadFileNode | LocalUploadDirectoryNode;

export interface LocalUploadSelection {
  readonly nodes: readonly LocalUploadNode[];
  readonly folderDropUnsupported: boolean;
}

export interface UploadFailure {
  readonly path: string;
  readonly message: string;
  readonly skipped: boolean;
}

export interface UploadTransferState {
  readonly isOpen: boolean;
  readonly isRunning: boolean;
  readonly total: number;
  readonly completed: number;
  readonly failures: readonly UploadFailure[];
  readonly notice: string | null;
}
