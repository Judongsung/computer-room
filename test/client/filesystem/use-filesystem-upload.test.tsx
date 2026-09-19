import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { deferred } from "@test/support/widgets/deferred";
import { fileEntry } from "@test/support/filesystem/file-entry";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFilesystemUpload } from "@client/hooks/filesystem/use-filesystem-upload";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { DesktopPlacement } from "@/types/filesystem/filesystem";
import type { LocalUploadNode } from "@client/types/filesystem/upload";

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

  it.each([true, false])("serializes desktop uploads with explicit placement=%s so D1 order allocation cannot race", async (explicitPlacement) => {
    const tracker = uploadTracker();
    const gateway = uploadGateway(tracker.upload);
    const { result } = renderHook(() =>
      useFilesystemUpload(gateway, vi.fn()),
    );
    const placement: DesktopPlacement | undefined = explicitPlacement ? { targetIndex: 0, capacity: 10 } : undefined;

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
  it("stops pending jobs, preserves in-flight successes and retries only unfinished files", async () => {
    const pending = deferred<FilesystemFileEntry>();
    const gateway = new FakeFilesystemGateway();
    const uploadFile = vi.spyOn(gateway, "uploadFile")
      .mockReturnValueOnce(pending.promise);
    const changed = vi.fn();
    const { result, rerender } = renderHook(({ onChanged }) => useFilesystemUpload(gateway, onChanged), {
      initialProps: { onChanged: vi.fn() },
    });
    let running!: Promise<void>;
    act(() => {
      running = result.current.upload(fileNodes(3), FILESYSTEM_ROOT_ID.DESKTOP, { targetIndex: 0, capacity: 10 });
      result.current.stop();
      void result.current.retry();
      void result.current.upload(fileNodes(1), FILESYSTEM_ROOT_ID.DOCUMENTS);
    });
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(result.current.state.isStopping).toBe(true);
    rerender({ onChanged: changed });
    await act(async () => {
      pending.resolve(fileEntry("first", "file-0.txt", "text/plain"));
      await running;
    });
    expect(result.current.state).toMatchObject({ succeeded: 1, remaining: 2, isRunning: false });
    expect(changed).toHaveBeenCalledOnce();
    await act(() => result.current.retry());
    expect(uploadFile.mock.calls.map((call) => call[1].name)).toEqual(["file-0.txt", "file-1.txt", "file-2.txt"]);
    expect(result.current.state.isOpen).toBe(false);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("reuses successful folders and files after folder and file failures", async () => {
    const gateway = new FakeFilesystemGateway();
    const create = vi.spyOn(gateway, "createDirectory").mockRejectedValueOnce(new Error("folder failed"));
    const upload = vi.spyOn(gateway, "uploadFile").mockRejectedValueOnce(new Error("file failed"));
    const { result } = renderHook(() => useFilesystemUpload(gateway, vi.fn()));
    const nodes: LocalUploadNode[] = [
      { kind: FILESYSTEM_ENTRY_KIND.DIRECTORY, name: "folder", children: fileNodes(2) },
      ...fileNodes(1),
    ];
    await act(() => result.current.upload(nodes, FILESYSTEM_ROOT_ID.DOCUMENTS));
    expect(result.current.state.failures).toHaveLength(4);
    await act(() => result.current.retry());
    expect(create).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledTimes(4);
    expect(result.current.state.isOpen).toBe(false);

    upload.mockRejectedValueOnce(new Error("child failed"));
    await act(() => result.current.upload([nodes[0]!], FILESYSTEM_ROOT_ID.DOCUMENTS));
    const parentId = upload.mock.calls.at(-1)![0];
    await act(() => result.current.retry());
    expect(create).toHaveBeenCalledTimes(3);
    expect(upload.mock.calls.at(-1)![0]).toBe(parentId);
    expect(upload).toHaveBeenCalledTimes(7);
  });

  it.each(["gateway", "unmount"])("ignores old completion and stops follow-ups after %s changes", async (change) => {
    const gateway = new FakeFilesystemGateway();
    const pending = deferred<FilesystemFileEntry>();
    const upload = vi.spyOn(gateway, "uploadFile").mockReturnValue(pending.promise);
    const changed = vi.fn();
    const { result, rerender, unmount } = renderHook(({ api }) => useFilesystemUpload(api, changed), {
      initialProps: { api: gateway },
    });
    let running!: Promise<void>;
    act(() => { running = result.current.upload(fileNodes(2), FILESYSTEM_ROOT_ID.DESKTOP, { targetIndex: 0, capacity: 10 }); });
    if (change === "gateway") rerender({ api: new FakeFilesystemGateway() });
    else unmount();
    await act(async () => {
      pending.resolve(fileEntry("old", "old.txt", "text/plain"));
      await running;
    });
    expect(upload).toHaveBeenCalledOnce();
    expect(changed).not.toHaveBeenCalled();
    if (change === "gateway") expect(result.current.state.isOpen).toBe(false);
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
