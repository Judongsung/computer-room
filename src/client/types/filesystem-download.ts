import type { FILESYSTEM_DOWNLOAD_STATUS } from "../constants/filesystem-download";

export type FilesystemDownloadStatus =
  (typeof FILESYSTEM_DOWNLOAD_STATUS)[keyof typeof FILESYSTEM_DOWNLOAD_STATUS];

export interface FilesystemDownloadState {
  readonly status: FilesystemDownloadStatus;
  readonly completedFiles: number;
  readonly totalFiles: number;
  readonly transferredBytes: number;
  readonly totalBytes: number;
  readonly skippedWidgetCount: number;
  readonly error: string | null;
}

export interface BrowserFileHandle {
  createWritable(): Promise<WritableStream<Uint8Array>>;
}

export interface BrowserSaveFilePickerOptions {
  readonly suggestedName: string;
  readonly types: readonly {
    readonly description: string;
    readonly accept: Readonly<Record<string, readonly string[]>>;
  }[];
}

export type BrowserSaveFilePicker = (
  options: BrowserSaveFilePickerOptions,
) => Promise<BrowserFileHandle>;
