import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type { FilesystemDirectoryEntry } from "@/types/filesystem/filesystem";
import type { FilesystemDownloadManifest } from "@/types/filesystem/download";
import { FILESYSTEM_DOWNLOAD_STATUS } from "@client/constants/filesystem/download";
import { useFilesystemDownload } from "@client/hooks/filesystem/use-filesystem-download";
import type { FilesystemDownloadGateway } from "@client/types/filesystem/ports/transfer";

const UPDATED_AT = "2026-08-23T01:00:00.000Z";
const DIRECTORY: FilesystemDirectoryEntry = {
  id: "folder",
  parentId: "documents",
  kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
  name: "자료",
  createdAt: UPDATED_AT,
  updatedAt: UPDATED_AT,
  desktopOrder: null,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useFilesystemDownload", () => {
  it("opens the disk picker before requesting a manifest and closes on success", async () => {
    const picker = vi.fn(async () => ({
      createWritable: async () => new WritableStream<Uint8Array>(),
    }));
    vi.stubGlobal("showSaveFilePicker", picker);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4]))),
    );
    const createDownloadManifest = vi.fn(async () => manifest());
    const gateway = downloadGateway(createDownloadManifest);
    const { result } = renderHook(() => useFilesystemDownload(gateway));

    await act(async () => {
      await result.current.start([DIRECTORY]);
    });

    expect(picker).toHaveBeenCalledOnce();
    expect(createDownloadManifest).toHaveBeenCalledWith([DIRECTORY.id]);
    expect(picker.mock.invocationCallOrder[0]).toBeLessThan(
      createDownloadManifest.mock.invocationCallOrder[0] ?? Number.MAX_VALUE,
    );
    expect(result.current.state.status).toBe(FILESYSTEM_DOWNLOAD_STATUS.IDLE);
  });

  it("keeps the failing relative path and retry guidance in the result window", async () => {
    const abort = vi.fn();
    vi.stubGlobal("showSaveFilePicker", vi.fn(async () => ({
      createWritable: async () => new WritableStream<Uint8Array>({ abort }),
    })));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const { result } = renderHook(() =>
      useFilesystemDownload(downloadGateway(vi.fn(async () => manifest()))),
    );

    await act(async () => {
      await result.current.start([DIRECTORY]);
    });

    expect(result.current.state.status).toBe(FILESYSTEM_DOWNLOAD_STATUS.ERROR);
    expect(result.current.state.error).toContain("자료/한글.txt");
    expect(result.current.state.error).toContain("다시 시도");
    expect(abort).toHaveBeenCalledOnce();
  });

  it("does not request a manifest when the save picker is cancelled", async () => {
    vi.stubGlobal(
      "showSaveFilePicker",
      vi.fn(async () => {
        throw new DOMException("cancelled", "AbortError");
      }),
    );
    const createDownloadManifest = vi.fn(async () => manifest());
    const { result } = renderHook(() =>
      useFilesystemDownload(downloadGateway(createDownloadManifest)),
    );

    await act(async () => {
      await result.current.start([DIRECTORY]);
    });

    expect(createDownloadManifest).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe(FILESYSTEM_DOWNLOAD_STATUS.IDLE);
  });
});

function downloadGateway(
  createDownloadManifest: () => Promise<FilesystemDownloadManifest>,
): FilesystemDownloadGateway {
  return {
    createDownloadManifest,
    downloadUrl: (id) => `/api/files/${id}/download`,
  };
}

function manifest(): FilesystemDownloadManifest {
  return {
    archiveName: "자료.zip",
    entries: [
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
