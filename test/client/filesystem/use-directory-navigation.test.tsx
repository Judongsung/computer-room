import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import type { FilesystemDirectoryPage } from "@/types/filesystem/filesystem";
import { useDirectoryNavigation } from "@client/hooks/filesystem/directory/use-directory-navigation";

describe("useDirectoryNavigation", () => {
  it("shares forward, parent, and history navigation without owning mutations", async () => {
    const pages = new Map([
      ["root", directoryPage("root", null, ["root"])],
      ["child", directoryPage("child", "root", ["root", "child"])],
    ]);
    const listDirectory = vi.fn(async (id?: string) => pages.get(id ?? "root")!);
    const gateway = { listDirectory };
    const onDirectoryLoaded = vi.fn();
    const { result } = renderHook(() =>
      useDirectoryNavigation({
        gateway,
        initialDirectoryId: "root",
        errorFallback: "조회 실패",
        onDirectoryLoaded,
      }),
    );

    await waitFor(() => expect(result.current.page?.directory.id).toBe("root"));
    act(() => result.current.navigate("child"));
    await waitFor(() => expect(result.current.page?.directory.id).toBe("child"));
    expect(result.current.history).toEqual(["root"]);

    act(() => result.current.navigateUp());
    await waitFor(() => expect(result.current.page?.directory.id).toBe("root"));
    act(() => result.current.navigateBack());
    await waitFor(() => expect(result.current.page?.directory.id).toBe("child"));
    expect(onDirectoryLoaded).toHaveBeenLastCalledWith("child", "child");
    expect(listDirectory.mock.calls.map(([id]) => id)).toEqual([
      "root", "child", "root", "child",
    ]);
  });
});

function directoryPage(
  id: string,
  parentId: string | null,
  breadcrumbIds: readonly string[],
): FilesystemDirectoryPage {
  return {
    directory: {
      id,
      parentId,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name: id,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      desktopOrder: null,
    },
    breadcrumbs: breadcrumbIds.map((breadcrumbId) => ({
      id: breadcrumbId,
      name: breadcrumbId,
    })),
    items: [],
    nextOffset: null,
    sort: DEFAULT_FILESYSTEM_DIRECTORY_SORT,
  };
}
