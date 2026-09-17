import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FILESYSTEM_DRAG_SOURCE } from "@client/constants/filesystem/filesystem";
import { useRecycleBinController } from "@client/hooks/filesystem/recycle/use-recycle-bin-controller";
import { XpContextMenuProvider } from "@client/state/context-menu/context-menu-context";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { dragTransfer } from "@test/support/filesystem/drag-transfer";

it("serializes trash drops and reports partial failures alongside closed programs and refreshed directories", async () => {
  const gateway = new FakeFilesystemGateway();
  let complete!: (result: FilesystemBatchResult) => void;
  const trash = vi.spyOn(gateway, "trashEntries").mockImplementation(() =>
    new Promise((resolve) => { complete = resolve; }),
  );
  const onFilesystemChanged = vi.fn();
  const onWidgetsClosed = vi.fn();
  const { result } = renderHook(() => useRecycleBinController({
    gateway, desktopCapacity: 20, filesystemRevision: 0, onFilesystemChanged, onWidgetsClosed,
  }), { wrapper: XpContextMenuProvider });
  await waitFor(() => expect(result.current.page).not.toBeNull());
  const event = {
    dataTransfer: dragTransfer({ ids: ["saved", "failed"], primaryId: "saved", source: FILESYSTEM_DRAG_SOURCE.ACTIVE }),
  };

  act(() => {
    result.current.dropIntoTrash(event);
    result.current.dropIntoTrash(event);
  });
  expect(trash).toHaveBeenCalledExactlyOnceWith(["saved", "failed"]);
  expect(result.current.busy).toBe(true);
  act(() => result.current.dropIntoTrash(event));
  expect(trash).toHaveBeenCalledOnce();
  const batch: FilesystemBatchResult = {
    succeededIds: ["saved"], entries: [], closedWidgetIds: ["program"],
    failures: [{ id: "failed", code: "FILESYSTEM_ENTRY_NOT_FOUND", message: "Entry not found" }],
  };
  await act(async () => complete(batch));
  expect(result.current.busy).toBe(false);
  expect(result.current.batchResult).toEqual(batch);
  expect(onWidgetsClosed).toHaveBeenCalledExactlyOnceWith(["program"]);
  expect(onFilesystemChanged).toHaveBeenCalledOnce();
});


it.each(["empty", "delete"])("refreshes after %s failure without clearing the mutation error", async (command) => {
  const gateway = new FakeFilesystemGateway();
  const onFilesystemChanged = vi.fn();
  const { result } = renderHook(() => useRecycleBinController({
    gateway, desktopCapacity: 20, filesystemRevision: 0,
    onFilesystemChanged, onWidgetsClosed: vi.fn(),
  }), { wrapper: XpContextMenuProvider });
  await waitFor(() => expect(result.current.page).not.toBeNull());
  const fail = async (): Promise<FilesystemBatchResult> => { throw new Error("delete failed"); };
  await act(() => command === "empty"
    ? result.current.runChange(fail)
    : result.current.runBatchChange(fail, true));
  expect(onFilesystemChanged).toHaveBeenCalledOnce();
  await act(() => result.current.reload());
  expect(result.current.error).toBe("delete failed");
});
