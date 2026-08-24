import { FILESYSTEM_ENTRY_KIND } from "../../constants/filesystem";
import type { FilesystemDownloadManifest } from "../../types/filesystem-download";
import { API_REQUEST_OPTIONS } from "../constants/api";

interface ArchiveProgressCallbacks {
  readonly onBytes: (bytes: number) => void;
  readonly onFileComplete: () => void;
}

export class FilesystemArchiveFileError extends Error {
  constructor(readonly path: string) {
    super(path);
    this.name = "FilesystemArchiveFileError";
  }
}

export async function createFilesystemArchiveStream(
  manifest: FilesystemDownloadManifest,
  signal: AbortSignal,
  progress: ArchiveProgressCallbacks,
): Promise<ReadableStream<Uint8Array>> {
  const { makeZip } = await import("client-zip");
  return makeZip(archiveInputs(manifest, signal, progress), {
    buffersAreUTF8: true,
  });
}

async function* archiveInputs(
  manifest: FilesystemDownloadManifest,
  signal: AbortSignal,
  progress: ArchiveProgressCallbacks,
) {
  for (const entry of manifest.entries) {
    if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      yield { name: entry.path, lastModified: new Date(entry.updatedAt) };
      continue;
    }
    const response = await fetch(entry.downloadUrl, {
      credentials: API_REQUEST_OPTIONS.CREDENTIALS,
      signal,
    });
    if (!response.ok || !response.body) {
      throw new FilesystemArchiveFileError(entry.path);
    }
    yield {
      name: entry.path,
      size: entry.size,
      lastModified: new Date(entry.updatedAt),
      input: response.body.pipeThrough(
        progressTransform(progress.onBytes, progress.onFileComplete),
      ),
    };
  }
}

function progressTransform(
  onBytes: (bytes: number) => void,
  onFileComplete: () => void,
): TransformStream<Uint8Array, Uint8Array> {
  return new TransformStream({
    transform(chunk, controller) {
      onBytes(chunk.byteLength);
      controller.enqueue(chunk);
    },
    flush() {
      onFileComplete();
    },
  });
}
