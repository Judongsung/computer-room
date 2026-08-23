import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFilesystemUpload } from "../../src/client/hooks/use-filesystem-upload";
import type { FilesystemGateway } from "../../src/client/types/filesystem";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "../../src/constants/filesystem";
import type { DesktopPlacement } from "../../src/types/filesystem";
import type { LocalUploadNode } from "../../src/client/types/upload";

describe("useFilesystemUpload", () => {
  it("limits ordinary file uploads to three concurrent requests", async () => {
    const tracker = uploadTracker();
    const gateway = uploadGateway(tracker.upload);
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useFilesystemUpload(gateway, onChanged),
    );

    await act(() =>
      result.current.upload(fileNodes(7), FILESYSTEM_ROOT_ID.DOCUMENTS),
    );

    expect(tracker.maximum()).toBe(3);
    expect(onChanged).toHaveBeenCalledOnce();
    expect(result.current.state).toMatchObject({
      isOpen: false,
      isRunning: false,
    });
  });

  it("serializes desktop uploads so D1 order allocation cannot race", async () => {
    const tracker = uploadTracker();
    const gateway = uploadGateway(tracker.upload);
    const { result } = renderHook(() =>
      useFilesystemUpload(gateway, vi.fn()),
    );
    const placement: DesktopPlacement = { targetIndex: 0, capacity: 10 };

    await act(() =>
      result.current.upload(
        fileNodes(4),
        FILESYSTEM_ROOT_ID.DESKTOP,
        placement,
      ),
    );

    expect(tracker.maximum()).toBe(1);
    expect(tracker.placements()).toEqual([
      placement,
      placement,
      placement,
      placement,
    ]);
  });

  it("keeps failed transfers open so their details remain available", async () => {
    const uploadFile = vi
      .fn<FilesystemGateway["uploadFile"]>()
      .mockRejectedValue(new Error("업로드 실패"));
    const gateway = uploadGateway(uploadFile);
    const { result } = renderHook(() =>
      useFilesystemUpload(gateway, vi.fn()),
    );

    await act(() =>
      result.current.upload(fileNodes(1), FILESYSTEM_ROOT_ID.DOCUMENTS),
    );

    expect(result.current.state).toMatchObject({
      isOpen: true,
      isRunning: false,
      total: 1,
      completed: 1,
      failures: [
        {
          path: "file-0.txt",
          message: "업로드 실패",
          skipped: false,
        },
      ],
    });
  });
});

function fileNodes(count: number): LocalUploadNode[] {
  return Array.from({ length: count }, (_, index) => {
    const file = new File([String(index)], `file-${index}.txt`, {
      type: "text/plain",
    });
    return {
      kind: FILESYSTEM_ENTRY_KIND.FILE,
      name: file.name,
      file,
    };
  });
}

function uploadTracker() {
  let active = 0;
  let maximum = 0;
  const receivedPlacements: Array<DesktopPlacement | undefined> = [];
  return {
    upload: vi.fn(
      async (
        _parentId: string,
        file: File,
        placement?: DesktopPlacement,
      ) => {
        active += 1;
        maximum = Math.max(maximum, active);
        receivedPlacements.push(placement);
        await new Promise((resolve) => window.setTimeout(resolve, 1));
        active -= 1;
        return {
          id: file.name,
          parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
          kind: FILESYSTEM_ENTRY_KIND.FILE,
          name: file.name,
          contentType: file.type,
          size: file.size,
          createdAt: "2026-08-22T00:00:00.000Z",
          updatedAt: "2026-08-22T00:00:00.000Z",
          desktopOrder: null,
        };
      },
    ),
    maximum: () => maximum,
    placements: () => receivedPlacements,
  };
}

function uploadGateway(
  uploadFile: FilesystemGateway["uploadFile"],
): FilesystemGateway {
  return { uploadFile } as FilesystemGateway;
}
