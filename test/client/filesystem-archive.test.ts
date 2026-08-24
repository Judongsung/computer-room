import { afterEach, describe, expect, it, vi } from "vitest";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type { FilesystemDownloadManifest } from "@/types/filesystem/download";
import {
  createFilesystemArchiveStream,
  FilesystemArchiveFileError,
} from "@client/domain/filesystem/archive";

const UPDATED_AT = "2026-08-23T01:00:00.000Z";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("filesystem archive streaming", () => {
  it("streams UTF-8 names and empty folders while reporting file progress", async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi.fn(async () => new Response(payload));
    vi.stubGlobal("fetch", fetchMock);
    let transferred = 0;
    let completed = 0;

    const bytes = await readAll(
      await createFilesystemArchiveStream(manifest(), new AbortController().signal, {
        onBytes: (count) => {
          transferred += count;
        },
        onFileComplete: () => {
          completed += 1;
        },
      }),
    );

    expect(bytes.slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
    expect(new TextDecoder().decode(bytes)).toContain("한글.txt");
    expect(new TextDecoder().decode(bytes)).toContain("빈 폴더/");
    expect(transferred).toBe(payload.byteLength);
    expect(completed).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/files/file/download",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("identifies the file whose protected download failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));

    await expect(
      readAll(
        await createFilesystemArchiveStream(
          manifest(),
          new AbortController().signal,
          { onBytes: () => undefined, onFileComplete: () => undefined },
        ),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FilesystemArchiveFileError>>({
        path: "자료/한글.txt",
      }),
    );
  });
});

function manifest(): FilesystemDownloadManifest {
  return {
    archiveName: "자료.zip",
    entries: [
      {
        kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
        path: "자료/빈 폴더/",
        updatedAt: UPDATED_AT,
      },
      {
        kind: FILESYSTEM_ENTRY_KIND.FILE,
        id: "file",
        path: "자료/한글.txt",
        size: 4,
        updatedAt: UPDATED_AT,
        downloadUrl: "/api/files/file/download",
      },
    ],
    totalFileCount: 1,
    totalBytes: 4,
    skippedWidgetIds: [],
  };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
