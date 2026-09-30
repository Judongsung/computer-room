import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { FilesystemDirectoryPage } from "@/types/filesystem/filesystem";
import { useDesktopEntries } from "@client/hooks/filesystem/use-desktop-entries";
import { directoryPage } from "@test/support/filesystem/directory-page";
import { fileEntry } from "@test/support/filesystem/file-entry";
import { deferred } from "@test/support/widgets/deferred";

const FIRST = fileEntry("first", "first.png", "image/png");
const NEXT = { ...fileEntry("next", "next.png", "image/png"), desktopOrder: 1 };

function gateway() {
  return { listDirectory: vi.fn(async (_id?: string, _offset?: number) => directoryPage([FIRST])) };
}

it("publishes only the complete list, merges latest IDs, and sorts by desktop order then ID", async () => {
  const api = gateway();
  const first = deferred<FilesystemDirectoryPage>();
  const next = deferred<FilesystemDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
  const { result } = renderHook(() => useDesktopEntries(api, 0));
  await act(async () => { first.resolve(directoryPage([FIRST, NEXT], 100)); await first.promise; });
  expect(result.current.entries).toEqual([]);
  expect(api.listDirectory.mock.calls).toEqual([[FILESYSTEM_ROOT_ID.DESKTOP, 0], [FILESYSTEM_ROOT_ID.DESKTOP, 100]]);
  const updated = { ...FIRST, name: "updated.png", desktopOrder: 2 };
  const unorderedZ = { ...fileEntry("z", "z.png", "image/png"), desktopOrder: null };
  const unorderedA = { ...fileEntry("a", "a.png", "image/png"), desktopOrder: null };
  await act(async () => { next.resolve(directoryPage([updated, unorderedZ, unorderedA])); await next.promise; });
  expect(result.current.entries).toEqual([NEXT, updated, unorderedA, unorderedZ]);
  expect(result.current.error).toBeNull();
});

it.each(["revision", "gateway", "unmount"])("stops the old first page from requesting more after %s", async (change) => {
  const api = gateway();
  const nextApi = gateway();
  const old = deferred<FilesystemDirectoryPage>();
  const latest = deferred<FilesystemDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(old.promise);
  if (change === "revision") api.listDirectory.mockReturnValueOnce(latest.promise);
  if (change === "gateway") nextApi.listDirectory.mockReturnValueOnce(latest.promise);
  const { result, rerender, unmount } = renderHook(({ gateway: port, revision }) => useDesktopEntries(port, revision), {
    initialProps: { gateway: api, revision: 0 },
  });
  if (change === "unmount") unmount();
  else rerender({ gateway: change === "gateway" ? nextApi : api, revision: 1 });
  await act(async () => { old.resolve(directoryPage([FIRST], 100)); await old.promise; });
  expect(api.listDirectory).toHaveBeenCalledTimes(change === "revision" ? 2 : 1);
  expect(api.listDirectory.mock.calls.every(([, offset]) => offset === 0)).toBe(true);
  if (change !== "unmount") {
    expect(result.current.entries).toEqual([]);
    await act(async () => { latest.resolve(directoryPage([NEXT])); await latest.promise; });
    expect(result.current.entries).toEqual([NEXT]);
    expect(result.current.error).toBeNull();
  }
});

it.each([false, true])("keeps the fresh list and error when an old revision finishes (failure=%s)", async (failure) => {
  const api = gateway();
  const old = deferred<FilesystemDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(old.promise).mockResolvedValueOnce(directoryPage([NEXT]));
  const { result, rerender } = renderHook(({ revision }) => useDesktopEntries(api, revision), { initialProps: { revision: 0 } });
  rerender({ revision: 1 });
  await act(async () => { await api.listDirectory.mock.results[1]!.value; });
  await act(async () => {
    if (failure) { old.reject(new Error("old failure")); await expect(old.promise).rejects.toThrow("old failure"); }
    else { old.resolve(directoryPage([FIRST], 100)); await old.promise; }
  });
  expect(result.current.entries).toEqual([NEXT]);
  expect(result.current.error).toBeNull();
  expect(api.listDirectory).toHaveBeenCalledTimes(2);
});

it("preserves loaded entries through refresh failure and replaces them after recovery", async () => {
  const api = gateway();
  const { result, rerender } = renderHook(({ revision }) => useDesktopEntries(api, revision), { initialProps: { revision: 0 } });
  await act(async () => { await api.listDirectory.mock.results[0]!.value; });
  const failed = deferred<FilesystemDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(failed.promise);
  rerender({ revision: 1 });
  expect(result.current.entries).toEqual([FIRST]);
  await act(async () => { failed.reject(new Error("refresh failed")); await expect(failed.promise).rejects.toThrow("refresh failed"); });
  expect(result.current.entries).toEqual([FIRST]);
  expect(result.current.error).toBe("refresh failed");
  api.listDirectory.mockResolvedValueOnce(directoryPage([NEXT]));
  rerender({ revision: 2 });
  await act(async () => { await api.listDirectory.mock.results[2]!.value; });
  expect(result.current.entries).toEqual([NEXT]);
  expect(result.current.error).toBeNull();
});

it("hides old entries and errors on the first render with another gateway", async () => {
  const api = gateway();
  const rendered: ReturnType<typeof useDesktopEntries>[] = [];
  const { result, rerender } = renderHook(({ gateway: port, revision }) => {
    const current = useDesktopEntries(port, revision);
    rendered.push(current);
    return current;
  }, { initialProps: { gateway: api, revision: 0 } });
  await act(async () => { await api.listDirectory.mock.results[0]!.value; });
  api.listDirectory.mockRejectedValueOnce(new Error("old error"));
  rerender({ gateway: api, revision: 1 });
  await act(async () => { await expect(api.listDirectory.mock.results[1]!.value).rejects.toThrow("old error"); });
  const nextApi = gateway();
  const next = deferred<FilesystemDirectoryPage>();
  nextApi.listDirectory.mockReturnValueOnce(next.promise);
  const firstRender = rendered.length;
  rerender({ gateway: nextApi, revision: 1 });
  expect(rendered[firstRender]).toEqual({ entries: [], error: null });
  expect(result.current.entries).toEqual([]);
  await act(async () => { next.reject(new Error("new error")); await expect(next.promise).rejects.toThrow("new error"); });
  expect(result.current).toEqual({ entries: [], error: "new error" });
});

it("clears the previous list when switching gateways A to B to A before B finishes", async () => {
  const api = gateway();
  const other = gateway();
  const pending = deferred<FilesystemDirectoryPage>();
  const latest = deferred<FilesystemDirectoryPage>();
  other.listDirectory.mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(({ gateway: port }) => useDesktopEntries(port, 0), {
    initialProps: { gateway: api },
  });
  await act(async () => { await api.listDirectory.mock.results[0]!.value; });
  expect(result.current.entries).toEqual([FIRST]);
  rerender({ gateway: other });
  api.listDirectory.mockReturnValueOnce(latest.promise);
  rerender({ gateway: api });
  expect(result.current).toEqual({ entries: [], error: null });
  await act(async () => {
    pending.reject(new Error("old gateway failure"));
    await expect(pending.promise).rejects.toThrow("old gateway failure");
  });
  expect(result.current).toEqual({ entries: [], error: null });
  await act(async () => { latest.resolve(directoryPage([NEXT])); await latest.promise; });
  expect(result.current.entries).toEqual([NEXT]);
  expect(other.listDirectory).toHaveBeenCalledTimes(1);
});

it("does not continue the disposed StrictMode page loop", async () => {
  const api = gateway();
  const old = deferred<FilesystemDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(old.promise).mockResolvedValueOnce(directoryPage([NEXT]));
  const { result } = renderHook(() => useDesktopEntries(api, 0), { wrapper: StrictMode });
  await act(async () => { await api.listDirectory.mock.results[1]!.value; old.resolve(directoryPage([FIRST], 100)); await old.promise; });
  expect(api.listDirectory).toHaveBeenCalledTimes(2);
  expect(result.current.entries).toEqual([NEXT]);
});
