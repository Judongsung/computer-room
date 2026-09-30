import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { StrictMode, useLayoutEffect } from "react";
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

    let running!: Promise<void>;
    act(() => { running = result.current.upload(fileNodes(7), FILESYSTEM_ROOT_ID.DOCUMENTS); });
    expect(tracker.upload).toHaveBeenCalledTimes(3);
    for (let index = 0; index < 7; index++) {
      await act(() => tracker.complete(index));
      expect(tracker.upload).toHaveBeenCalledTimes(Math.min(index + 4, 7));
    }
    await act(() => running);

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

    let running!: Promise<void>;
    act(() => { running = result.current.upload(fileNodes(4), FILESYSTEM_ROOT_ID.DESKTOP, placement); });
    for (let index = 0; index < 4; index++) {
      expect(tracker.upload).toHaveBeenCalledTimes(index + 1);
      await act(() => tracker.complete(index));
      expect(tracker.upload).toHaveBeenCalledTimes(Math.min(index + 2, 4));
    }
    await act(() => running);

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

  it("publishes correct intermediate counts and preserves earlier failure snapshots in job order", async () => {
    const pending = Array.from({ length: 3 }, () => deferred<FilesystemFileEntry>());
    const attempts = [0, 0, 0];
    const upload = vi.fn(async (_parent: string, file: File) => {
      const index = Number(file.name.match(/\d+/)![0]);
      attempts[index]! += 1;
      return attempts[index] === 1 ? pending[index]!.promise : fileEntry(file.name, file.name, "text/plain");
    });
    const changed = vi.fn();
    const gateway = uploadGateway(upload);
    const { result } = renderHook(() => useFilesystemUpload(gateway, changed));
    let running!: Promise<void>;
    act(() => { running = result.current.upload(fileNodes(3), FILESYSTEM_ROOT_ID.DOCUMENTS); });
    await act(async () => { pending[2]!.resolve(fileEntry("last", "file-2.txt", "text/plain")); await pending[2]!.promise; });
    expect(result.current.state).toMatchObject({ total: 3, completed: 1, succeeded: 1, remaining: 2, failures: [] });
    await act(async () => { pending[1]!.reject(new Error("second failed")); await expect(pending[1]!.promise).rejects.toThrow("second failed"); });
    const earlier = result.current.state;
    expect(earlier).toMatchObject({ completed: 2, succeeded: 1, remaining: 1, failures: [{ path: "file-1.txt", message: "second failed" }] });
    await act(async () => { pending[0]!.reject(new Error("first failed")); await running; });
    expect(result.current.state).toMatchObject({ completed: 3, succeeded: 1, remaining: 0, failures: [
      { path: "file-0.txt", message: "first failed" }, { path: "file-1.txt", message: "second failed" },
    ] });
    expect(earlier.remaining).toBe(1);
    expect(earlier.failures).toEqual([{ path: "file-1.txt", message: "second failed", skipped: false }]);
    await act(() => result.current.retry());
    expect(attempts).toEqual([2, 2, 1]);
    expect(result.current.state).toMatchObject({ isOpen: false, total: 0, completed: 0, succeeded: 0, failures: [] });
    expect(earlier.failures).toHaveLength(1);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("keeps StrictMode replay progress independent of completions from the disposed run", async () => {
    const tracker = uploadTracker();
    const gateway = uploadGateway(tracker.upload);
    const changed = vi.fn();
    const runs: Promise<void>[] = [];
    const nodes = fileNodes(3);
    const { result } = renderHook(() => {
      const controller = useFilesystemUpload(gateway, changed);
      useLayoutEffect(() => { runs.push(controller.upload(nodes, FILESYSTEM_ROOT_ID.DOCUMENTS)); }, [controller.upload]);
      return controller;
    }, { wrapper: StrictMode });
    expect(tracker.upload).toHaveBeenCalledTimes(6);
    await act(async () => {
      for (let i = 0; i < 3; i++) await tracker.complete(i);
      await runs[0];
    });
    expect(result.current.state).toMatchObject({ isRunning: true, total: 3, completed: 0, succeeded: 0, remaining: 3 });
    expect(changed).not.toHaveBeenCalled();
    await act(async () => {
      for (let i = 3; i < 6; i++) await tracker.complete(i);
      await runs[1];
    });
    expect(result.current.state.isOpen).toBe(false);
    expect(changed).toHaveBeenCalledOnce();
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
  const pending: ReturnType<typeof deferred<void>>[] = [];
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
        const request = deferred<void>();
        pending.push(request);
        await request.promise;
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
    complete: (index: number) => { pending[index]!.resolve(); return pending[index]!.promise; },
    maximum: () => maximum,
    placements: () => receivedPlacements,
  };
}

function uploadGateway(
  uploadFile: FilesystemGateway["uploadFile"],
): FilesystemGateway {
  return { uploadFile } as FilesystemGateway;
}
