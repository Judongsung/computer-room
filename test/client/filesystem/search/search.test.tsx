import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@client/errors/api-error";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { MobileSearch } from "@client/components/mobile/filesystem/search/mobile-search";
import { useSearchResults } from "@client/hooks/filesystem/search/use-filesystem-search";
import { ThumbnailLoadProvider } from "@client/state/filesystem/thumbnail-load-context";
import { FILESYSTEM_SEARCH_COPY } from "@client/content/ko/filesystem/search";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { fileEntry } from "@test/support/filesystem/file-entry";
import { deferred } from "@test/support/widgets/deferred";
import type { FilesystemSearchPage } from "@/types/filesystem/search/search";

const item = { entry: fileEntry("one", "report.txt", "text/plain"), parentPath: "내 문서" };

describe("file search", () => {
  it("waits for submission, opens entries and parents, and restores submitted conditions", async () => {
    const gateway = new FakeFilesystemGateway();
    const search = vi.spyOn(gateway, "search").mockResolvedValue({ items: [item], nextOffset: null });
    const submitted = vi.fn();
    const openEntry = vi.fn();
    const openDirectory = vi.fn();
    const props = { gateway, location: { directory: null }, onSubmitted: submitted, onOpenEntry: openEntry, onOpenDirectory: openDirectory };
    const view = render(<MobileSearch {...props} />, { wrapper: ThumbnailLoadProvider });
    expect(search).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "report" } });
    expect(search).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
    await screen.findByText("report.txt");
    fireEvent.click(screen.getByRole("button", { name: /report.txt/ }));
    expect(openEntry).toHaveBeenCalledWith(item.entry);
    fireEvent.click(screen.getByRole("button", { name: FILESYSTEM_SEARCH_COPY.OPEN_FOLDER }));
    expect(openDirectory).toHaveBeenCalledWith(item.entry.parentId, item.parentPath);
    view.unmount();
    render(<MobileSearch {...props} location={{ directory: null, initialQuery: submitted.mock.calls[0]![0] }} />, { wrapper: ThumbnailLoadProvider });
    await screen.findByText("report.txt");
    expect(screen.getByRole("searchbox")).toHaveValue("report");
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("shares repeated submissions and hides old results only when new criteria are submitted", async () => {
    const gateway = new FakeFilesystemGateway();
    const pending = deferred<FilesystemSearchPage>();
    const search = vi.spyOn(gateway, "search")
      .mockResolvedValueOnce({ items: [item], nextOffset: null })
      .mockReturnValue(pending.promise);
    render(<MobileSearch gateway={gateway} location={{ directory: null }}
      onSubmitted={vi.fn()} onOpenEntry={vi.fn()} onOpenDirectory={vi.fn()} />,
    { wrapper: ThumbnailLoadProvider });
    const input = screen.getByRole("searchbox");
    const form = input.closest("form")!;
    fireEvent.change(input, { target: { value: "report" } });
    fireEvent.submit(form);
    await screen.findByText("report.txt");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(search).toHaveBeenCalledTimes(2);
    expect(screen.getByText("report.txt")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "new" } });
    expect(screen.getByText("report.txt")).toBeInTheDocument();
    expect(search).toHaveBeenCalledTimes(2);
    fireEvent.submit(form);
    expect(screen.queryByText("report.txt")).not.toBeInTheDocument();
    await act(async () => pending.resolve({ items: [], nextOffset: null }));
    expect(screen.getByText(FILESYSTEM_SEARCH_COPY.EMPTY)).toBeInTheDocument();
  });

  it("invalidates stale queries and shares pagination while preserving results on failure", async () => {
    const gateway = new FakeFilesystemGateway();
    const old = deferred<FilesystemSearchPage>();
    const more = deferred<FilesystemSearchPage>();
    const search = vi.spyOn(gateway, "search")
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ items: [item], nextOffset: 20 })
      .mockReturnValueOnce(more.promise)
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce({ items: [item], nextOffset: 20 })
      .mockResolvedValueOnce({ items: [item], nextOffset: null });
    const { result, rerender } = renderHook(({ query }) => useSearchResults(gateway, query, 0), {
      initialProps: { query: { q: "old", kind: "all" as const } },
    });
    rerender({ query: { q: "new", kind: "all" } });
    await waitFor(() => expect(result.current.page?.items).toHaveLength(1));
    await act(async () => old.reject(new Error("obsolete")));
    expect(result.current.error).toBeNull();
    act(() => { void result.current.loadMore(); void result.current.loadMore(); });
    expect(search).toHaveBeenCalledTimes(3);
    await act(async () => more.resolve({ items: [{ ...item, parentPath: "latest" }], nextOffset: null }));
    expect(result.current.page?.items).toEqual([{ ...item, parentPath: "latest" }]);
    await act(() => result.current.reload());
    expect(result.current.error).toBe("failed");
    expect(result.current.page?.items).toHaveLength(1);
    await act(() => result.current.retry());
    expect(result.current.error).toBeNull();
    expect(search.mock.calls.slice(-2).map((call) => call[1])).toEqual([0, 20]);
  });

  it("hides results when the submitted directory becomes inactive", async () => {
    const gateway = new FakeFilesystemGateway();
    const error = FILESYSTEM_ERRORS.ENTRY_NOT_ACTIVE;
    vi.spyOn(gateway, "search")
      .mockResolvedValueOnce({ items: [item], nextOffset: null })
      .mockRejectedValueOnce(new ApiError(error.code, error.message, error.status));
    const query = { q: "report", kind: "all" as const, directoryId: "folder" };
    const { result } = renderHook(() => useSearchResults(gateway, query, 0));
    await waitFor(() => expect(result.current.page?.items).toHaveLength(1));
    await act(() => result.current.reload());
    expect(result.current.page).toBeNull();
    expect(result.current.error).toBe(error.message);
  });
});
