import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type { FilesystemTrashPage } from "@/types/filesystem/filesystem";
import { usePaginatedTrash } from "@client/hooks/filesystem/recycle/use-paginated-trash";

describe("usePaginatedTrash", () => {
  it("appends trash pages and blocks concurrent pagination", async () => {
    let resolveMore: (page: FilesystemTrashPage) => void = () => undefined;
    const more = new Promise<FilesystemTrashPage>((resolve) => {
      resolveMore = resolve;
    });
    const listTrash = vi.fn(async (offset = 0) =>
      offset === 0 ? trashPage(["first"], 1) : more,
    );
    const gateway = { listTrash };
    const { result } = renderHook(() =>
      usePaginatedTrash({
        gateway,
        errorFallback: "조회 실패",
      }),
    );

    await waitFor(() => expect(result.current.page?.items).toHaveLength(1));
    act(() => {
      void result.current.loadMore();
      void result.current.loadMore();
    });
    expect(listTrash).toHaveBeenCalledTimes(2);

    await act(async () => resolveMore(trashPage(["second"], null)));
    expect(result.current.page?.items.map((item) => item.entry.id)).toEqual([
      "first",
      "second",
    ]);
  });

  it("discards stale pages after a revision refresh", async () => {
    const stale = deferred<FilesystemTrashPage>();
    const listTrash = vi
      .fn<() => Promise<FilesystemTrashPage>>()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(trashPage(["current"], null));
    const gateway = { listTrash };
    const { result, rerender } = renderHook(
      ({ revision }) =>
        usePaginatedTrash({
          gateway,
          revision,
          errorFallback: "조회 실패",
        }),
      { initialProps: { revision: 0 } },
    );

    rerender({ revision: 1 });
    await waitFor(() => expect(result.current.page?.items[0]?.entry.id).toBe("current"));
    await act(async () => stale.resolve(trashPage(["stale"], null)));

    expect(result.current.page?.items[0]?.entry.id).toBe("current");
  });
});

function trashPage(ids: readonly string[], nextOffset: number | null): FilesystemTrashPage {
  return {
    items: ids.map((id) => ({
      entry: {
        id,
        parentId: "root",
        kind: FILESYSTEM_ENTRY_KIND.FILE,
        name: `${id}.png`,
        contentType: "image/png",
        size: 1,
        createdAt: "2026-08-28T00:00:00.000Z",
        updatedAt: "2026-08-28T00:00:00.000Z",
        desktopOrder: null,
      },
      deletedAt: "2026-08-28T01:00:00.000Z",
      deletionStartedAt: null,
      originalParentId: "root",
      originalLocation: "내 문서",
    })),
    nextOffset,
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
