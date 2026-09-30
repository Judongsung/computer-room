import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import type { FilesystemDirectoryPage } from "@/types/filesystem/filesystem";
import { deferred } from "@test/support/widgets/deferred";
import { useDirectoryNavigation } from "@client/hooks/filesystem/directory/use-directory-navigation";

describe("useDirectoryNavigation", () => {
  it("shares forward, parent, and history navigation without owning mutations", async () => {
    const pages = new Map([
      ["root", directoryPage("root", null, ["root"])],
      ["child", directoryPage("child", "root", ["root", "child"])],
    ]);
    const reads = Array.from({ length: 4 }, () => deferred<FilesystemDirectoryPage>());
    const listDirectory = vi.fn((_id?: string): Promise<FilesystemDirectoryPage> => reads[listDirectory.mock.calls.length - 1]!.promise);
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

    await act(async () => {
      reads[0]!.resolve(pages.get("root")!);
      await reads[0]!.promise;
    });
    expect(result.current.page?.directory.id).toBe("root");
    act(() => result.current.navigate("child"));
    await act(async () => {
      reads[1]!.resolve(pages.get("child")!);
      await reads[1]!.promise;
    });
    expect(result.current.page?.directory.id).toBe("child");
    expect(result.current.history).toEqual(["root"]);

    act(() => result.current.navigateUp());
    await act(async () => {
      reads[2]!.resolve(pages.get("root")!);
      await reads[2]!.promise;
    });
    expect(result.current.page?.directory.id).toBe("root");
    act(() => result.current.navigateBack());
    await act(async () => {
      reads[3]!.resolve(pages.get("child")!);
      await reads[3]!.promise;
    });
    expect(result.current.page?.directory.id).toBe("child");
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
