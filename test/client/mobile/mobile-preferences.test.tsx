import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useMobilePreferences } from "@client/hooks/platform/use-mobile-preferences";
import type { MobilePreferences } from "@/types/platform/mobile-preferences";
import { deferred } from "@test/support/widgets/deferred";

function gateway() {
  return {
    getPreferences: vi.fn(async (): Promise<MobilePreferences> => ({ wallpaper: null })),
    updateWallpaper: vi.fn(async (): Promise<MobilePreferences> => ({ wallpaper: null })),
  };
}

it("queues one focus/visibility read during saving and rejects duplicate saves", async () => {
  const api = gateway();
  const pending = deferred<MobilePreferences>();
  api.updateWallpaper.mockReturnValue(pending.promise);
  const { result } = renderHook(() => useMobilePreferences(api));
  await waitFor(() => expect(result.current.loading).toBe(false));
  let saved!: Promise<boolean>;
  act(() => { saved = result.current.updateWallpaper(null); });
  await act(async () => {
    expect(await result.current.updateWallpaper(null)).toBe(false);
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    await result.current.refresh();
  });
  expect(api.getPreferences).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve({ wallpaper: null }); expect(await saved).toBe(true); });
  expect(api.getPreferences).toHaveBeenCalledTimes(2);
  expect(api.updateWallpaper).toHaveBeenCalledTimes(1);
  expect(result.current.saving).toBe(false);
  expect(result.current.loading).toBe(false);
});

it.each([false, true])("ignores invalidated read completion (failure=%s) without waiting to refresh", async (failure) => {
  const api = gateway();
  const old = deferred<MobilePreferences>();
  api.getPreferences.mockReturnValueOnce(old.promise);
  const { result } = renderHook(() => useMobilePreferences(api));
  let first!: Promise<void>;
  act(() => { first = result.current.refresh(); expect(result.current.refresh()).toBe(first); });
  await act(async () => { expect(await result.current.updateWallpaper(null)).toBe(true); });
  expect(api.getPreferences).toHaveBeenCalledTimes(2);
  await act(async () => {
    if (failure) old.reject(new Error("stale"));
    else old.resolve({ wallpaper: null });
    await first;
  });
  expect(result.current.error).toBeNull();
  expect(result.current.loading).toBe(false);
  expect(result.current.saving).toBe(false);
});

it("preserves save errors after a queued successful read and allows retry", async () => {
  const api = gateway();
  const pending = deferred<MobilePreferences>();
  api.updateWallpaper.mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useMobilePreferences(api));
  await waitFor(() => expect(result.current.loading).toBe(false));
  let saved!: Promise<boolean>;
  act(() => { saved = result.current.updateWallpaper(null); });
  await act(async () => { await result.current.refresh(); pending.reject(new Error("save failed")); expect(await saved).toBe(false); });
  expect(result.current.error).toBe("save failed");
  expect(result.current.saving).toBe(false);
  await act(async () => { expect(await result.current.updateWallpaper(null)).toBe(true); });
  expect(result.current.error).toBeNull();
  expect(api.getPreferences).toHaveBeenCalledTimes(2);
});

it("invalidates saving and queued reads on gateway change and unmount", async () => {
  const api = gateway();
  const next = gateway();
  const pending = deferred<MobilePreferences>();
  const nextRead = deferred<MobilePreferences>();
  api.updateWallpaper.mockReturnValue(pending.promise);
  next.getPreferences.mockReturnValue(nextRead.promise);
  const { result, rerender, unmount } = renderHook(({ api }) => useMobilePreferences(api), { initialProps: { api } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  let saved!: Promise<boolean>;
  act(() => { saved = result.current.updateWallpaper(null); void result.current.refresh(); });
  rerender({ api: next });
  await act(async () => { pending.resolve({ wallpaper: null }); expect(await saved).toBe(false); });
  expect(result.current.loading).toBe(true);
  expect(result.current.saving).toBe(false);
  expect(api.getPreferences).toHaveBeenCalledTimes(1);
  unmount();
  await act(async () => { nextRead.reject(new Error("disposed")); });
  expect(next.getPreferences).toHaveBeenCalledTimes(1);
});

it("recovers from initial read failure", async () => {
  const api = gateway();
  api.getPreferences.mockRejectedValueOnce(new Error("read failed"));
  const { result } = renderHook(() => useMobilePreferences(api));
  await waitFor(() => expect(result.current.error).toBe("read failed"));
  await act(async () => { await result.current.refresh(); });
  expect(result.current.error).toBeNull();
  expect(result.current.loading).toBe(false);
});
