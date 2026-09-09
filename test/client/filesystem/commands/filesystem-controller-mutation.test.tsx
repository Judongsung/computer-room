import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { FilesystemDirectoryEntry } from "@/types/filesystem/filesystem";
import { useDesktopFilesystemController } from "@client/hooks/desktop/filesystem/use-desktop-filesystem-controller";
import { useDocumentsController } from "@client/hooks/filesystem/explorer/use-documents-controller";
import { XpContextMenuProvider } from "@client/state/context-menu/context-menu-context";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { deferred } from "@test/support/widgets/deferred";

describe("filesystem controller mutation wiring", () => {
  it("uses one desktop lock for repeated dialog commands", async () => {
    const pending = deferred<FilesystemDirectoryEntry>();
    const gateway = new FakeFilesystemGateway();
    const created = await gateway.createDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "first");
    const createDirectory = vi.spyOn(gateway, "createDirectory").mockReturnValue(pending.promise);
    const { result } = renderHook(() => useDesktopFilesystemController({
      gateway,
      workAreaRef: { current: null },
      desktop: { width: 1024, height: 768 },
      widgets: [],
      onWidgetChange: vi.fn(),
      onRemoveWidgets: vi.fn(),
      onWindowClosed: vi.fn(),
    }));
    act(() => {
      result.current.createDirectory("first");
      result.current.createDirectory("second");
    });
    expect(createDirectory).toHaveBeenCalledExactlyOnceWith(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "first",
      expect.any(Object),
    );
    expect(result.current.dialogBusy).toBe(true);
    await act(async () => pending.resolve(created));
    expect(result.current.dialogBusy).toBe(false);
    expect(result.current.revision).toBe(1);
  });

  it("applies global batch results but protects a newly navigated directory", async () => {
    const gateway = new FakeFilesystemGateway();
    const child = await gateway.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "child");
    const pending = deferred<FilesystemBatchResult>();
    const onFilesystemChanged = vi.fn();
    const onEntryChanged = vi.fn();
    const onWidgetsClosed = vi.fn();
    const { result } = renderHook(() => useDocumentsController({
      gateway,
      windowId: "documents",
      initialDirectoryId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      filesystemRevision: 0,
      onFilesystemChanged,
      onDirectoryChanged: vi.fn(),
      onOpenFile: vi.fn(),
      onOpenWidget: vi.fn(),
      onEntryChanged,
      onWidgetsClosed,
      onUploadNodes: vi.fn(async () => undefined),
      desktopCapacity: 20,
    }), { wrapper: XpContextMenuProvider });
    await waitFor(() => expect(result.current.currentDirectoryId).toBe(FILESYSTEM_ROOT_ID.DOCUMENTS));
    act(() => {
      result.current.setDialog("move");
      void result.current.runBatchChange(() => pending.promise);
      result.current.explorer.navigate(child.id);
    });
    await waitFor(() => expect(result.current.currentDirectoryId).toBe(child.id));
    const batch: FilesystemBatchResult = {
      succeededIds: ["changed"],
      entries: [{ ...child, name: "latest" }],
      closedWidgetIds: ["closed"],
      failures: [{ id: "old-failure", code: "FAILED", message: "failed" }],
    };
    await act(async () => pending.resolve(batch));
    expect(onEntryChanged).toHaveBeenCalledOnce();
    expect(onWidgetsClosed).toHaveBeenCalledExactlyOnceWith(["closed"]);
    expect(onFilesystemChanged).toHaveBeenCalledOnce();
    expect(result.current.batchResult).toEqual(batch);
    expect(result.current.selection.selectedIds.has("old-failure")).toBe(false);
    expect(result.current.dialog).toBe("move");
  });
});

it("applies rename through the latest callback and ignores completion after unmount", async () => {
  const gateway = new FakeFilesystemGateway();
  const entry = await gateway.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "before");
  const first = deferred<FilesystemDirectoryEntry>();
  const second = deferred<FilesystemDirectoryEntry>();
  vi.spyOn(gateway, "updateEntry").mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const initialChanged = vi.fn();
  const latestChanged = vi.fn();
  const options = {
    gateway, windowId: "documents", initialDirectoryId: FILESYSTEM_ROOT_ID.DOCUMENTS, filesystemRevision: 0,
    onFilesystemChanged: vi.fn(), onDirectoryChanged: vi.fn(), onOpenFile: vi.fn(), onOpenWidget: vi.fn(),
    onEntryChanged: initialChanged, onWidgetsClosed: vi.fn(), onUploadNodes: vi.fn(async () => undefined), desktopCapacity: 20,
  };
  const { result, rerender, unmount } = renderHook(useDocumentsController, { initialProps: options, wrapper: XpContextMenuProvider });
  act(() => { void result.current.renameEntry(entry.id, "first"); });
  rerender({ ...options, onEntryChanged: latestChanged });
  await act(async () => first.resolve({ ...entry, name: "first" }));
  expect(initialChanged).not.toHaveBeenCalled();
  expect(latestChanged).toHaveBeenCalledExactlyOnceWith({ ...entry, name: "first" });
  act(() => { void result.current.renameEntry(entry.id, "second"); });
  unmount();
  await act(async () => second.resolve({ ...entry, name: "second" }));
  expect(latestChanged).toHaveBeenCalledOnce();
  expect(options.onFilesystemChanged).toHaveBeenCalledOnce();
});
