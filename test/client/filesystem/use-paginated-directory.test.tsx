import { ApiError } from "@client/errors/api-error";
import { GUEST_ERRORS } from "@/constants/guest/errors/guest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import type {
  FilesystemDirectoryPage,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";
import { usePaginatedDirectory } from "@client/hooks/filesystem/directory/use-paginated-directory";

describe("usePaginatedDirectory", () => {
  it("filters and appends pages while preventing duplicate load-more requests", async () => {
    let resolveMore: (page: FilesystemDirectoryPage) => void = () => undefined;
    const more = new Promise<FilesystemDirectoryPage>((resolve) => {
      resolveMore = resolve;
    });
    const listDirectory = vi.fn(
      async (_directoryId?: string, offset = 0): Promise<FilesystemDirectoryPage> =>
        offset === 0
          ? directoryPage([fileEntry("file-1"), directoryEntry("folder-1")], 2)
          : more,
    );
    const gateway = { listDirectory };
    const { result } = renderHook(() =>
      usePaginatedDirectory({
        gateway,
        directoryId: "root",
        errorFallback: "조회 실패",
        includeEntry: isFile,
      }),
    );

    await waitFor(() => expect(result.current.page?.items).toHaveLength(1));
    act(() => {
      void result.current.loadMore();
      void result.current.loadMore();
    });
    expect(listDirectory).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveMore(directoryPage([fileEntry("file-2")], null));
    });
    expect(result.current.page?.items.map((entry) => entry.id)).toEqual([
      "file-1",
      "file-2",
    ]);
  });

  it("ignores a response from the previous directory", async () => {
    const oldRequest = deferred<FilesystemDirectoryPage>();
    const listDirectory = vi.fn((directoryId?: string) =>
      directoryId === "old"
        ? oldRequest.promise
        : Promise.resolve(directoryPage([fileEntry("new-file", "new")], null, "new")),
    );
    const gateway = { listDirectory };
    const { result, rerender } = renderHook(
      ({ directoryId }) =>
        usePaginatedDirectory({
          gateway,
          directoryId,
          errorFallback: "조회 실패",
        }),
      { initialProps: { directoryId: "old" } },
    );

    rerender({ directoryId: "new" });
    await waitFor(() => expect(result.current.page?.directory.id).toBe("new"));
    await act(async () => {
      oldRequest.resolve(directoryPage([fileEntry("old-file", "old")], null, "old"));
    });

    expect(result.current.page?.directory.id).toBe("new");
    expect(result.current.page?.items[0]?.id).toBe("new-file");
  });

  it("reloads on revision changes and exposes a retryable error", async () => {
    const listDirectory = vi
      .fn<() => Promise<FilesystemDirectoryPage>>()
      .mockRejectedValueOnce(new Error("일시 오류"))
      .mockResolvedValue(directoryPage([], null));
    const gateway = { listDirectory };
    const { result, rerender } = renderHook(
      ({ revision }) =>
        usePaginatedDirectory({
          gateway,
          directoryId: "root",
          revision,
          errorFallback: "조회 실패",
        }),
      { initialProps: { revision: 0 } },
    );

    await waitFor(() => expect(result.current.error).toBe("일시 오류"));
    rerender({ revision: 1 });
    await waitFor(() => expect(result.current.page).not.toBeNull());

    expect(result.current.error).toBeNull();
    expect(listDirectory).toHaveBeenCalledTimes(2);
  });

  it("refreshes the loaded page count atomically even when pages are filtered", async () => {
    const pending = deferred<FilesystemDirectoryPage>();
    const listDirectory = vi.fn<() => Promise<FilesystemDirectoryPage>>()
      .mockResolvedValueOnce(directoryPage([directoryEntry("hidden")], 2))
      .mockResolvedValueOnce(directoryPage([fileEntry("old")], null))
      .mockResolvedValueOnce(directoryPage([fileEntry("new")], 2))
      .mockReturnValueOnce(pending.promise);
    const gateway = { listDirectory };
    const { result } = renderHook(() =>
      usePaginatedDirectory({
        gateway,
        directoryId: "root",
        errorFallback: "failed",
        includeEntry: isFile,
      }),
    );
    await waitFor(() => expect(result.current.page).not.toBeNull());
    await act(() => result.current.loadMore());
    act(() => {
      void result.current.reload();
      void result.current.reload();
      void result.current.loadMore();
    });
    await waitFor(() => expect(listDirectory).toHaveBeenCalledTimes(4));
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.page?.items[0]?.id).toBe("old");
    await act(async () => pending.resolve(directoryPage([fileEntry("new", "updated"), fileEntry("last")], null)));
    expect(result.current.page?.items.map(({ id }) => id)).toEqual(["new", "last"]);
    expect(result.current.page?.items[0]?.parentId).toBe("updated");
    expect(result.current.isRefreshing).toBe(false);
  });

  it("preserves all pages on refresh failure and retries the same range", async () => {
    const listDirectory = vi.fn<() => Promise<FilesystemDirectoryPage>>()
      .mockResolvedValueOnce(directoryPage([fileEntry("one")], 1))
      .mockResolvedValueOnce(directoryPage([fileEntry("two")], null))
      .mockResolvedValueOnce(directoryPage([fileEntry("changed")], 1))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(directoryPage([fileEntry("changed")], 1))
      .mockResolvedValueOnce(directoryPage([fileEntry("two")], null));
    const gateway = { listDirectory };
    const { result } = renderHook(() =>
      usePaginatedDirectory({
        gateway,
        directoryId: "root",
        errorFallback: "failed",
      }),
    );
    await waitFor(() => expect(result.current.page).not.toBeNull());
    await act(() => result.current.loadMore());
    const previous = result.current.page;
    await act(() => result.current.reload());
    expect(result.current.page).toBe(previous);
    expect(result.current.error).toBe("offline");
    await act(() => result.current.retry());
    expect(result.current.error).toBeNull();
    expect(result.current.page?.items.map(({ id }) => id)).toEqual(["changed", "two"]);
    expect(listDirectory.mock.calls).toEqual([
      ["root", 0], ["root", 1],
      ["root", 0], ["root", 1],
      ["root", 0], ["root", 1],
    ]);
  });

  it("invalidates load-more before refresh and ignores its late failure", async () => {
    let rejectMore!: (error: Error) => void;
    const more = new Promise<FilesystemDirectoryPage>((_, reject) => { rejectMore = reject; });
    const listDirectory = vi.fn<() => Promise<FilesystemDirectoryPage>>()
      .mockResolvedValueOnce(directoryPage([fileEntry("old")], 1))
      .mockReturnValueOnce(more)
      .mockResolvedValueOnce(directoryPage([fileEntry("current")], null));
    const gateway = { listDirectory };
    const { result } = renderHook(() =>
      usePaginatedDirectory({
        gateway,
        directoryId: "root",
        errorFallback: "failed",
      }),
    );
    await waitFor(() => expect(result.current.page).not.toBeNull());
    act(() => { void result.current.loadMore(); });
    await act(() => result.current.reload());
    await act(async () => rejectMore(new Error("stale")));
    expect(result.current.page?.items[0]?.id).toBe("current");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoadingMore).toBe(false);
  });

  it("retries a failed next page and hides cached contents after publication is revoked", async () => {
    const listDirectory = vi.fn<() => Promise<FilesystemDirectoryPage>>()
      .mockResolvedValueOnce(directoryPage([fileEntry("one")], 1))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(directoryPage([fileEntry("one"), fileEntry("two")], null))
      .mockRejectedValueOnce(new ApiError(GUEST_ERRORS.RESOURCE_NOT_FOUND.code, "revoked", 404));
    const gateway = { listDirectory };
    const { result } = renderHook(() =>
      usePaginatedDirectory({
        gateway,
        directoryId: "root",
        errorFallback: "failed",
      }),
    );
    await waitFor(() => expect(result.current.page).not.toBeNull());
    await act(() => result.current.loadMore());
    await act(() => result.current.retry());
    expect(listDirectory).toHaveBeenLastCalledWith("root", 1);
    expect(result.current.page?.items).toHaveLength(2);
    await act(() => result.current.reload());
    expect(result.current.page).toBeNull();
    expect(result.current.error).toBe("revoked");
  });

  it("stops follow-up pages after unmount and ignores the previous gateway", async () => {
    const pending = deferred<FilesystemDirectoryPage>();
    const old = { listDirectory: vi.fn().mockReturnValue(pending.promise) };
    const next = { listDirectory: vi.fn().mockResolvedValue(directoryPage([fileEntry("next")], null)) };
    const { result, rerender, unmount } = renderHook(
      ({ gateway }) => usePaginatedDirectory({
        gateway,
        directoryId: "root",
        errorFallback: "failed",
      }),
      { initialProps: { gateway: old } },
    );
    rerender({ gateway: next });
    await waitFor(() => expect(result.current.page?.items[0]?.id).toBe("next"));
    unmount();
    await act(async () => pending.resolve(directoryPage([fileEntry("old")], 1)));
    expect(old.listDirectory).toHaveBeenCalledTimes(1);
  });

});

function directoryPage(
  items: readonly FilesystemEntry[],
  nextOffset: number | null,
  id = "root",
): FilesystemDirectoryPage {
  return {
    directory: directoryEntry(id),
    breadcrumbs: [{ id, name: id }],
    items,
    nextOffset,
    sort: DEFAULT_FILESYSTEM_DIRECTORY_SORT,
  };
}

function directoryEntry(id: string) {
  return {
    id,
    parentId: null,
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name: id,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    desktopOrder: null,
  } as const;
}

function fileEntry(id: string, parentId = "root") {
  return {
    id,
    parentId,
    kind: FILESYSTEM_ENTRY_KIND.FILE,
    name: `${id}.png`,
    contentType: "image/png",
    size: 1,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    desktopOrder: null,
  } as const;
}

function isFile(
  entry: FilesystemEntry,
): entry is Extract<FilesystemEntry, { readonly kind: "file" }> {
  return entry.kind === FILESYSTEM_ENTRY_KIND.FILE;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
