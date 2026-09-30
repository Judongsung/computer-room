import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MEDIA_KIND } from "@/constants/filesystem/media";
import type { MediaKind } from "@/types/filesystem/media";
import type { FilesystemDirectoryPage } from "@/types/filesystem/filesystem";
import { useMediaDirectory } from "@client/hooks/media/use-media-directory";
import { directoryPage } from "@test/support/filesystem/directory-page";
import { fileEntry } from "@test/support/filesystem/file-entry";
import { deferred } from "@test/support/widgets/deferred";

const IMAGE = { ...fileEntry("image", "image.png", "image/png"), parentId: "a" };
const NEXT = { ...fileEntry("next", "next.png", "image/png"), parentId: "a" };
const VIDEO = { ...fileEntry("video", "video.mp4", "video/mp4"), parentId: "a" };

function gateway() {
  return { listDirectory: vi.fn(async (_id?: string, _offset?: number) => directoryPage([IMAGE], null, "a")) };
}

it.each([undefined, MEDIA_KIND.IMAGE, MEDIA_KIND.VIDEO])("merges all pages before media filtering and preserves directory order (kind=%s)", async (kind) => {
  const api = gateway();
  const first = deferred<FilesystemDirectoryPage>();
  const next = deferred<FilesystemDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
  const { result } = renderHook(() => useMediaDirectory(api, "a", 0, kind));
  await act(async () => { first.resolve(directoryPage([IMAGE, VIDEO, NEXT], 100, "a")); await first.promise; });
  expect(result.current).toEqual({ entries: [], error: null, isLoading: true });
  const noLongerMedia = { ...IMAGE, contentType: "text/plain" };
  const updated = { ...NEXT, name: "updated.png" };
  await act(async () => { next.resolve(directoryPage([noLongerMedia, updated], null, "a")); await next.promise; });
  expect(result.current.entries).toEqual(kind === MEDIA_KIND.IMAGE ? [updated] : kind === MEDIA_KIND.VIDEO ? [VIDEO] : [VIDEO, updated]);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBeNull();
  expect(api.listDirectory.mock.calls).toEqual([["a", 0], ["a", 100]]);
});

it.each(["directory", "kind", "gateway", "revision", "unmount"])("stops old page requests after changing %s", async (change) => {
  const api = gateway();
  const nextApi = gateway();
  const old = deferred<FilesystemDirectoryPage>();
  const latest = deferred<FilesystemDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  nextApi.listDirectory.mockReturnValueOnce(latest.promise);
  const initialProps = { gateway: api, directoryId: "a", revision: 0, kind: undefined as MediaKind | undefined };
  const { result, rerender, unmount } = renderHook(({ gateway: port, directoryId, revision, kind }) => useMediaDirectory(port, directoryId, revision, kind), { initialProps });
  if (change === "unmount") unmount();
  else rerender({
    gateway: change === "gateway" ? nextApi : api,
    directoryId: change === "directory" ? "b" : "a",
    revision: change === "revision" ? 1 : 0,
    kind: change === "kind" ? MEDIA_KIND.IMAGE : undefined,
  });
  await act(async () => { old.resolve(directoryPage([IMAGE], 100, "a")); await old.promise; });
  expect(api.listDirectory).toHaveBeenCalledTimes(change === "gateway" || change === "unmount" ? 1 : 2);
  expect(api.listDirectory.mock.calls.every(([, offset]) => offset === 0)).toBe(true);
  if (change !== "unmount") {
    expect(result.current).toEqual({ entries: [], error: null, isLoading: true });
    await act(async () => { latest.resolve(directoryPage([NEXT])); await latest.promise; });
    expect(result.current.entries).toEqual([NEXT]);
    expect(result.current.isLoading).toBe(false);
  }
});

it.each([false, true])("does not let old completion change the fresh loading state or entries (failure=%s)", async (failure) => {
  const api = gateway();
  const old = deferred<FilesystemDirectoryPage>();
  const latest = deferred<FilesystemDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  const { result, rerender } = renderHook(({ revision }) => useMediaDirectory(api, "a", revision), { initialProps: { revision: 0 } });
  rerender({ revision: 1 });
  await act(async () => {
    if (failure) { old.reject(new Error("old failure")); await expect(old.promise).rejects.toThrow("old failure"); }
    else { old.resolve(directoryPage([IMAGE], 100)); await old.promise; }
  });
  expect(result.current).toEqual({ entries: [], error: null, isLoading: true });
  await act(async () => { latest.resolve(directoryPage([NEXT])); await latest.promise; });
  expect(result.current).toEqual({ entries: [NEXT], error: null, isLoading: false });
  expect(api.listDirectory).toHaveBeenCalledTimes(2);
});

it("preserves the complete old list during same-target refresh and failure, then recovers", async () => {
  const api = gateway();
  const { result, rerender } = renderHook(({ revision }) => useMediaDirectory(api, "a", revision), { initialProps: { revision: 0 } });
  await act(async () => { await api.listDirectory.mock.results[0]!.value; });
  const first = deferred<FilesystemDirectoryPage>();
  const second = deferred<FilesystemDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  rerender({ revision: 1 });
  expect(result.current).toEqual({ entries: [IMAGE], error: null, isLoading: true });
  await act(async () => { first.resolve(directoryPage([NEXT], 100)); await first.promise; });
  expect(result.current.entries).toEqual([IMAGE]);
  await act(async () => { second.reject(new Error("second page failed")); await expect(second.promise).rejects.toThrow("second page failed"); });
  expect(result.current).toEqual({ entries: [IMAGE], error: "second page failed", isLoading: false });
  api.listDirectory.mockResolvedValueOnce(directoryPage([NEXT]));
  rerender({ revision: 2 });
  await act(async () => { await api.listDirectory.mock.results[3]!.value; });
  expect(result.current).toEqual({ entries: [NEXT], error: null, isLoading: false });
});

it.each(["directory", "kind", "gateway"])("hides old entries and errors in the first render with a new %s", async (change) => {
  const api = gateway();
  const rendered: ReturnType<typeof useMediaDirectory>[] = [];
  const initialProps = { gateway: api, directoryId: "a", revision: 0, kind: undefined as MediaKind | undefined };
  const { result, rerender } = renderHook(({ gateway: port, directoryId, revision, kind }) => {
    const current = useMediaDirectory(port, directoryId, revision, kind);
    rendered.push(current);
    return current;
  }, { initialProps });
  await act(async () => { await api.listDirectory.mock.results[0]!.value; });
  api.listDirectory.mockRejectedValueOnce(new Error("old error"));
  rerender({ ...initialProps, revision: 1 });
  await act(async () => { await expect(api.listDirectory.mock.results[1]!.value).rejects.toThrow("old error"); });
  const nextApi = gateway();
  const latest = deferred<FilesystemDirectoryPage>();
  (change === "gateway" ? nextApi : api).listDirectory.mockReturnValueOnce(latest.promise);
  const firstRender = rendered.length;
  rerender({ ...initialProps, gateway: change === "gateway" ? nextApi : api,
    directoryId: change === "directory" ? "b" : "a", kind: change === "kind" ? MEDIA_KIND.IMAGE : undefined, revision: 1 });
  expect(rendered[firstRender]).toEqual({ entries: [], error: null, isLoading: true });
  await act(async () => { latest.reject(new Error("new error")); await expect(latest.promise).rejects.toThrow("new error"); });
  expect(result.current).toEqual({ entries: [], error: "new error", isLoading: false });
});

it("does not reactivate a disposed StrictMode read", async () => {
  const api = gateway();
  const old = deferred<FilesystemDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(old.promise).mockResolvedValueOnce(directoryPage([NEXT]));
  const { result } = renderHook(() => useMediaDirectory(api, "a", 0), { wrapper: StrictMode });
  await act(async () => { await api.listDirectory.mock.results[1]!.value; old.resolve(directoryPage([IMAGE], 100)); await old.promise; });
  expect(api.listDirectory).toHaveBeenCalledTimes(2);
  expect(result.current).toEqual({ entries: [NEXT], error: null, isLoading: false });
});
