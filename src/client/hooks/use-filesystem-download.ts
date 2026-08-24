import { useCallback, useRef, useState } from "react";
import { FILESYSTEM_ENTRY_KIND } from "../../constants/filesystem";
import { FILESYSTEM_ARCHIVE } from "../../constants/filesystem-download";
import type { FilesystemEntry } from "../../types/filesystem";
import {
  FILESYSTEM_ARCHIVE_PICKER,
  FILESYSTEM_DOWNLOAD_STATUS,
} from "../constants/filesystem-download";
import {
  FILE_PICKER_ABORT_ERROR_NAME,
  FILESYSTEM_COPY,
} from "../constants/filesystem";
import {
  createFilesystemArchiveStream,
  FilesystemArchiveFileError,
} from "../domain/filesystem-archive";
import type { FilesystemDownloadGateway } from "../types/filesystem";
import type {
  BrowserSaveFilePicker,
  FilesystemDownloadState,
} from "../types/filesystem-download";
import { downloadFile } from "../utils/download-file";

const IDLE_STATE: FilesystemDownloadState = {
  status: FILESYSTEM_DOWNLOAD_STATUS.IDLE,
  completedFiles: 0,
  totalFiles: 0,
  transferredBytes: 0,
  totalBytes: 0,
  skippedWidgetCount: 0,
  error: null,
};

export function useFilesystemDownload(gateway: FilesystemDownloadGateway) {
  const [state, setState] = useState<FilesystemDownloadState>(IDLE_STATE);
  const cancellation = useRef<AbortController | null>(null);

  const start = useCallback(
    async (entries: readonly FilesystemEntry[]): Promise<void> => {
      const downloadable = entries.filter(
        (entry) => entry.kind !== FILESYSTEM_ENTRY_KIND.WIDGET,
      );
      if (downloadable.length === 0) {
        setState({
          ...IDLE_STATE,
          status: FILESYSTEM_DOWNLOAD_STATUS.ERROR,
          error: FILESYSTEM_COPY.DOWNLOAD_EMPTY,
        });
        return;
      }
      if (
        entries.length === 1 &&
        entries[0]?.kind === FILESYSTEM_ENTRY_KIND.FILE
      ) {
        downloadFile(gateway.downloadUrl(entries[0].id));
        return;
      }

      const picker = browserSaveFilePicker();
      if (!picker) {
        setState({
          ...IDLE_STATE,
          status: FILESYSTEM_DOWNLOAD_STATUS.ERROR,
          error: FILESYSTEM_COPY.DOWNLOAD_UNSUPPORTED,
        });
        return;
      }

      try {
        const handle = await picker({
          suggestedName: suggestedArchiveName(entries),
          types: [
            {
              description: FILESYSTEM_ARCHIVE_PICKER.DESCRIPTION,
              accept: {
                [FILESYSTEM_ARCHIVE_PICKER.MIME_TYPE]:
                  FILESYSTEM_ARCHIVE_PICKER.EXTENSIONS,
              },
            },
          ],
        });
        setState({
          ...IDLE_STATE,
          status: FILESYSTEM_DOWNLOAD_STATUS.PREPARING,
        });
        const controller = new AbortController();
        cancellation.current = controller;
        const manifest = await gateway.createDownloadManifest(
          entries.map((entry) => entry.id),
        );
        if (manifest.entries.length === 0) {
          throw new Error(FILESYSTEM_COPY.DOWNLOAD_EMPTY);
        }
        setState({
          status: FILESYSTEM_DOWNLOAD_STATUS.DOWNLOADING,
          completedFiles: 0,
          totalFiles: manifest.totalFileCount,
          transferredBytes: 0,
          totalBytes: manifest.totalBytes,
          skippedWidgetCount: manifest.skippedWidgetIds.length,
          error: null,
        });
        const writable = await handle.createWritable();
        const archive = await createFilesystemArchiveStream(
          manifest,
          controller.signal,
          {
            onBytes: (bytes) =>
              setState((current) => ({
                ...current,
                transferredBytes: current.transferredBytes + bytes,
              })),
            onFileComplete: () =>
              setState((current) => ({
                ...current,
                completedFiles: current.completedFiles + 1,
              })),
          },
        );
        await archive.pipeTo(writable, { signal: controller.signal });
        setState(IDLE_STATE);
      } catch (error) {
        if (!isCancellation(error)) {
          setState((current) => ({
            ...current,
            status: FILESYSTEM_DOWNLOAD_STATUS.ERROR,
            error: downloadErrorMessage(error),
          }));
        } else {
          setState(IDLE_STATE);
        }
      } finally {
        cancellation.current = null;
      }
    },
    [gateway],
  );

  const cancel = useCallback(() => cancellation.current?.abort(), []);
  const close = useCallback(() => setState(IDLE_STATE), []);
  return { state, start, cancel, close };
}

function browserSaveFilePicker(): BrowserSaveFilePicker | null {
  const picker = (
    window as Window & { showSaveFilePicker?: BrowserSaveFilePicker }
  ).showSaveFilePicker;
  return picker ? picker.bind(window) : null;
}

function suggestedArchiveName(entries: readonly FilesystemEntry[]): string {
  if (
    entries.length === 1 &&
    entries[0]?.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
  ) {
    return `${entries[0].name}${FILESYSTEM_ARCHIVE.EXTENSION}`;
  }
  return FILESYSTEM_ARCHIVE.DEFAULT_NAME;
}

function isCancellation(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    error.name === FILE_PICKER_ABORT_ERROR_NAME
  );
}

function downloadErrorMessage(error: unknown): string {
  if (error instanceof FilesystemArchiveFileError) {
    return FILESYSTEM_COPY.DOWNLOAD_FILE_FAILED(error.path);
  }
  return error instanceof Error && error.message
    ? error.message
    : FILESYSTEM_COPY.DOWNLOAD_FAILED;
}
