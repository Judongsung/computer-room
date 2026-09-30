import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { GUEST_PUBLICATION_STATE } from "@/constants/admin/guest-access";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { GuestAccessDirectoryPage, GuestAccessSettings, GuestPublicationMutationResult } from "@/types/admin/guest-access";
import { useGuestAccessAdmin } from "@client/hooks/admin/use-guest-access-admin";
import { FakeGuestAccessGateway, desktopFile, desktopPage, laterFile, photoPage } from "@test/support/admin/guest-access-gateway";
import { deferred } from "@test/support/widgets/deferred";

async function mount(api = new FakeGuestAccessGateway()) {
  const hook = renderHook(({ gateway }) => useGuestAccessAdmin(gateway), { initialProps: { gateway: api } });
  await act(async () => {
    await Promise.all([api.getSettings.mock.results[0]!.value, api.listDirectory.mock.results[0]!.value]);
  });
  return { api, ...hook };
}

it.each([false, true])("ignores an old settings read after saving (failure=%s)", async (failure) => {
  const { api, result } = await mount();
  const old = deferred<GuestAccessSettings>();
  const save = deferred<GuestAccessSettings>();
  api.getSettings.mockReturnValueOnce(old.promise);
  api.updateSettings.mockReturnValueOnce(save.promise);
  let read!: Promise<void>;
  let saved!: Promise<void>;
  act(() => { read = result.current.retry(); saved = result.current.updateEnabled(true); });
  expect(result.current.settings).toEqual({ enabled: true });
  expect(result.current.settingsBusy).toBe(true);
  await act(async () => { save.resolve({ enabled: true }); await saved; });
  await act(async () => {
    if (failure) old.reject(new Error("old settings"));
    else old.resolve({ enabled: false });
    await read;
  });
  expect(result.current.settings).toEqual({ enabled: true });
  expect(result.current.settingsBusy).toBe(false);
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBeNull();
});

it("locks duplicate settings writes synchronously and queues one retry read", async () => {
  const { api, result } = await mount();
  const save = deferred<GuestAccessSettings>();
  const refreshed = deferred<GuestAccessSettings>();
  api.updateSettings.mockReturnValueOnce(save.promise);
  api.getSettings.mockReturnValueOnce(refreshed.promise);
  let saved!: Promise<void>;
  act(() => {
    saved = result.current.updateEnabled(true);
    void result.current.updateEnabled(false);
    void result.current.retry();
    void result.current.retry();
  });
  expect(api.updateSettings).toHaveBeenCalledTimes(1);
  expect(api.getSettings).toHaveBeenCalledTimes(1);
  await act(async () => { save.resolve({ enabled: true }); await saved; });
  expect(api.getSettings).toHaveBeenCalledTimes(2);
  expect(result.current.settingsBusy).toBe(false);
  expect(result.current.loading).toBe(true);
  await act(async () => { refreshed.resolve({ enabled: true }); await refreshed.promise; });
  expect(result.current.loading).toBe(false);
});

it("rolls settings back and keeps the save error through a successful read until the next save", async () => {
  const { api, result } = await mount();
  api.updateSettings.mockRejectedValueOnce(new Error("save failed"));
  await act(async () => { await result.current.updateEnabled(true); });
  expect(result.current.settings).toEqual({ enabled: false });
  expect(result.current.settingsBusy).toBe(false);
  expect(result.current.error).toBe("save failed");
  await act(async () => { await result.current.retry(); });
  expect(result.current.error).toBe("save failed");
  expect(api.updateSettings).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.updateEnabled(true); });
  expect(result.current.settings).toEqual({ enabled: true });
  expect(result.current.error).toBeNull();
});

it.each(["settings", "directory"])("preserves the successful half when %s initially fails and can retry", async (failure) => {
  const api = new FakeGuestAccessGateway();
  const settings = deferred<GuestAccessSettings>();
  const page = deferred<GuestAccessDirectoryPage>();
  api.getSettings.mockReturnValueOnce(settings.promise);
  api.listDirectory.mockReturnValueOnce(page.promise);
  const { result } = renderHook(() => useGuestAccessAdmin(api));
  await act(async () => {
    if (failure === "settings") {
      settings.reject(new Error("settings failed"));
      await expect(settings.promise).rejects.toThrow("settings failed");
    } else { settings.resolve({ enabled: true }); await settings.promise; }
  });
  expect(result.current.loading).toBe(true);
  await act(async () => {
    if (failure === "directory") {
      page.reject(new Error("directory failed"));
      await expect(page.promise).rejects.toThrow("directory failed");
    } else { page.resolve(desktopPage(api.items)); await page.promise; }
  });
  expect(result.current.loading).toBe(false);
  expect(result.current.settings).toEqual(failure === "settings" ? null : { enabled: true });
  expect(result.current.page).toEqual(failure === "directory" ? null : desktopPage(api.items));
  expect(result.current.error).toBe(`${failure} failed`);
  await act(async () => { await result.current.retry(); });
  expect(result.current.settings).toEqual({ enabled: false });
  expect(result.current.page).not.toBeNull();
  expect(result.current.error).toBeNull();
});

it.each([false, true])("ignores stale A pages through A-B-A navigation (failure=%s)", async (failure) => {
  const { api, result } = await mount();
  const old = deferred<GuestAccessDirectoryPage>();
  const latest = deferred<GuestAccessDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(old.promise).mockResolvedValueOnce(photoPage()).mockReturnValueOnce(latest.promise);
  let read!: Promise<void>;
  act(() => { read = result.current.retry(); });
  act(() => { result.current.navigate("photos"); });
  expect(result.current.page).toBeNull();
  act(() => { result.current.navigate(FILESYSTEM_ROOT_ID.DESKTOP); });
  await act(async () => {
    if (failure) old.reject(new Error("old page"));
    else old.resolve(desktopPage([laterFile()]));
    await read;
  });
  expect(result.current.page).toBeNull();
  expect(result.current.loading).toBe(true);
  expect(result.current.error).toBeNull();
  await act(async () => { latest.resolve(desktopPage(api.items)); await latest.promise; });
  expect(result.current.page?.items).toEqual(api.items);
  expect(result.current.loading).toBe(false);
  expect(api.getSettings).toHaveBeenCalledTimes(2); // Initial read and explicit retry only.
});

it.each([false, true])("invalidates old more pages on reload and protects current loading (failure=%s)", async (failure) => {
  const api = new FakeGuestAccessGateway();
  api.nextOffset = 100;
  const { result } = await mount(api);
  const more = deferred<GuestAccessDirectoryPage>();
  const fresh = deferred<GuestAccessDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(more.promise).mockReturnValueOnce(fresh.promise);
  let old!: Promise<void>;
  let reload!: Promise<void>;
  act(() => { old = result.current.loadMore(); expect(result.current.loadMore()).toBe(old); });
  expect(api.listDirectory).toHaveBeenCalledTimes(2);
  expect(result.current.loadingMore).toBe(true);
  act(() => { reload = result.current.retry(); void result.current.loadMore(); });
  expect(result.current.loadingMore).toBe(false);
  expect(api.listDirectory).toHaveBeenCalledTimes(3);
  await act(async () => {
    if (failure) more.reject(new Error("old more"));
    else more.resolve(desktopPage([laterFile()]));
    await old;
  });
  expect(result.current.loading).toBe(true);
  expect(result.current.page?.items).toEqual(api.items);
  expect(result.current.error).toBeNull();
  await act(async () => { fresh.resolve(desktopPage([desktopFile()])); await reload; });
  expect(result.current.page?.items).toEqual([desktopFile()]);
  expect(result.current.loading).toBe(false);
});

it("releases a failed more request, preserves entries, and reloads without writing", async () => {
  const api = new FakeGuestAccessGateway();
  api.nextOffset = 100;
  const { result } = await mount(api);
  api.listDirectory.mockRejectedValueOnce(new Error("more failed"));
  await act(async () => { await result.current.loadMore(); });
  expect(result.current.page?.items).toEqual(api.items);
  expect(result.current.loadingMore).toBe(false);
  expect(result.current.error).toBe("more failed");
  await act(async () => { await result.current.retry(); });
  expect(result.current.error).toBeNull();
  expect(api.listDirectory).toHaveBeenLastCalledWith(FILESYSTEM_ROOT_ID.DESKTOP);
  expect(api.updateSettings).not.toHaveBeenCalled();
  expect(api.setEntryPublished).not.toHaveBeenCalled();
});

it.each([false, true])("discards a stale more page through A-B-A even when its directory matches (failure=%s)", async (failure) => {
  const api = new FakeGuestAccessGateway();
  api.nextOffset = 100;
  const { result } = await mount(api);
  const more = deferred<GuestAccessDirectoryPage>();
  api.listDirectory.mockReturnValueOnce(more.promise);
  let read!: Promise<void>;
  act(() => { read = result.current.loadMore(); });
  await act(async () => { result.current.navigate("photos"); await api.listDirectory.mock.results.at(-1)!.value; });
  api.listDirectory.mockResolvedValueOnce(desktopPage([desktopFile()], 200));
  await act(async () => { result.current.navigate(FILESYSTEM_ROOT_ID.DESKTOP); await api.listDirectory.mock.results.at(-1)!.value; });
  await act(async () => {
    if (failure) more.reject(new Error("stale A more"));
    else more.resolve(desktopPage([laterFile()]));
    await read;
  });
  expect(result.current.page).toEqual(desktopPage([desktopFile()], 200));
  expect(result.current.loadingMore).toBe(false);
  expect(result.current.error).toBeNull();
  expect(api.getSettings).toHaveBeenCalledTimes(1);
});

it("merges duplicate page IDs using the latest item without losing existing entries", async () => {
  const api = new FakeGuestAccessGateway();
  api.nextOffset = 100;
  const { result } = await mount(api);
  const updated = { ...desktopFile(), publicationState: GUEST_PUBLICATION_STATE.PUBLIC };
  api.listDirectory.mockResolvedValueOnce(desktopPage([updated, laterFile()]));
  await act(async () => { await result.current.loadMore(); });
  expect(result.current.page?.items).toEqual([api.items[0], updated, laterFile()]);
  expect(result.current.page?.nextOffset).toBeNull();
});

it.each([false, true])("invalidates more pages during a publication write and keeps its result (failure=%s)", async (failure) => {
  const api = new FakeGuestAccessGateway();
  api.nextOffset = 100;
  const { result } = await mount(api);
  const more = deferred<GuestAccessDirectoryPage>();
  const save = deferred<GuestPublicationMutationResult>();
  api.listDirectory.mockReturnValueOnce(more.promise);
  api.setEntryPublished.mockReturnValueOnce(save.promise);
  let read!: Promise<void>;
  act(() => {
    read = result.current.loadMore();
    result.current.requestPublicationChange(desktopFile());
    result.current.requestPublicationChange(desktopFile());
    void result.current.loadMore();
    void result.current.retry();
    void result.current.retry();
  });
  expect(api.setEntryPublished).toHaveBeenCalledTimes(1);
  expect(api.listDirectory).toHaveBeenCalledTimes(2);
  expect(result.current.loadingMore).toBe(false);
  expect(result.current.page?.items[1]?.publicationState).toBe(GUEST_PUBLICATION_STATE.PUBLIC);
  await act(async () => { more.resolve(desktopPage([laterFile()])); await read; });
  expect(result.current.page?.items).toHaveLength(2);
  await act(async () => {
    if (failure) { save.reject(new Error("publication failed")); await expect(save.promise).rejects.toThrow("publication failed"); }
    else { save.resolve({ entryId: "readme", publicationState: GUEST_PUBLICATION_STATE.PUBLIC, affectedCount: 1 }); await save.promise; }
  });
  expect(api.listDirectory).toHaveBeenCalledTimes(3);
  expect(result.current.entryBusyId).toBeNull();
  expect(result.current.page?.items).toEqual(api.items);
  expect(result.current.error).toBe(failure ? "publication failed" : null);
});

it.each([false, true])("does not roll back the new view or reload the old folder after navigating (failure=%s)", async (failure) => {
  const { api, result } = await mount();
  const save = deferred<GuestPublicationMutationResult>();
  api.setEntryPublished.mockReturnValueOnce(save.promise);
  act(() => { result.current.requestPublicationChange(desktopFile()); });
  await act(async () => {
    result.current.navigate("photos");
    await api.listDirectory.mock.results.at(-1)!.value;
  });
  expect(result.current.page?.directory.id).toBe("photos");
  await act(async () => {
    if (failure) { save.reject(new Error("old save")); await expect(save.promise).rejects.toThrow("old save"); }
    else { save.resolve({ entryId: "readme", publicationState: GUEST_PUBLICATION_STATE.PUBLIC, affectedCount: 1 }); await save.promise; }
  });
  expect(result.current.page).toEqual(photoPage());
  expect(result.current.entryBusyId).toBeNull();
  expect(result.current.error).toBeNull();
  expect(api.listDirectory).toHaveBeenCalledTimes(failure ? 2 : 3);
  if (!failure) expect(api.listDirectory).toHaveBeenLastCalledWith("photos");
});

it("does not restore the old page after a failed publication through A-B-A navigation", async () => {
  const { api, result } = await mount();
  const save = deferred<GuestPublicationMutationResult>();
  api.setEntryPublished.mockReturnValueOnce(save.promise);
  act(() => { result.current.requestPublicationChange(desktopFile()); });
  await act(async () => { result.current.navigate("photos"); await api.listDirectory.mock.results.at(-1)!.value; });
  api.listDirectory.mockResolvedValueOnce(desktopPage([laterFile()]));
  await act(async () => { result.current.navigate(FILESYSTEM_ROOT_ID.DESKTOP); await api.listDirectory.mock.results.at(-1)!.value; });
  await act(async () => { save.reject(new Error("old A save")); await expect(save.promise).rejects.toThrow("old A save"); });
  expect(result.current.page?.items).toEqual([laterFile()]);
  expect(result.current.error).toBeNull();
  expect(result.current.entryBusyId).toBeNull();
});

it("shares first-page retries and invalidated read completion cannot release the saving lock", async () => {
  const { api, result } = await mount();
  const read = deferred<GuestAccessSettings>();
  const page = deferred<GuestAccessDirectoryPage>();
  const save = deferred<GuestAccessSettings>();
  api.getSettings.mockReturnValueOnce(read.promise);
  api.listDirectory.mockReturnValueOnce(page.promise);
  api.updateSettings.mockReturnValueOnce(save.promise);
  let first!: Promise<void>;
  let second!: Promise<void>;
  let saved!: Promise<void>;
  act(() => { first = result.current.retry(); second = result.current.retry(); saved = result.current.updateEnabled(true); });
  expect(api.getSettings).toHaveBeenCalledTimes(2);
  expect(api.listDirectory).toHaveBeenCalledTimes(2);
  await act(async () => { read.reject(new Error("old read")); page.resolve(desktopPage(api.items)); await Promise.all([first, second]); });
  expect(result.current.loading).toBe(false);
  expect(result.current.settingsBusy).toBe(true);
  expect(result.current.settings).toEqual({ enabled: true });
  expect(result.current.error).toBeNull();
  await act(async () => { save.resolve({ enabled: true }); await saved; });
  expect(result.current.settingsBusy).toBe(false);
});

it.each([false, true])("invalidates a pending settings save and queued read on unmount (failure=%s)", async (failure) => {
  const { api, result, unmount } = await mount();
  const save = deferred<GuestAccessSettings>();
  api.updateSettings.mockReturnValueOnce(save.promise);
  let saved!: Promise<void>;
  act(() => { saved = result.current.updateEnabled(true); void result.current.retry(); });
  unmount();
  await act(async () => {
    if (failure) save.reject(new Error("disposed save"));
    else save.resolve({ enabled: true });
    await saved;
  });
  expect(api.getSettings).toHaveBeenCalledTimes(1);
  expect(api.updateSettings).toHaveBeenCalledTimes(1);
});

it("closes a pending directory confirmation on navigation", async () => {
  const { api, result } = await mount();
  act(() => { result.current.requestPublicationChange(api.items[0]!); });
  expect(result.current.pendingDirectoryChange?.item.entry.id).toBe("photos");
  await act(async () => { result.current.navigate("photos"); await api.listDirectory.mock.results.at(-1)!.value; });
  expect(result.current.pendingDirectoryChange).toBeNull();
  await act(async () => { await result.current.confirmDirectoryChange(); });
  expect(api.setEntryPublished).not.toHaveBeenCalled();
});

it.each([false, true])("ignores reads and settings writes across gateway replacement (failure=%s)", async (failure) => {
  const { api, result, rerender } = await mount();
  const read = deferred<GuestAccessDirectoryPage>();
  const save = deferred<GuestAccessSettings>();
  api.listDirectory.mockReturnValueOnce(read.promise);
  api.updateSettings.mockReturnValueOnce(save.promise);
  let oldRead!: Promise<void>;
  let oldSave!: Promise<void>;
  act(() => { oldRead = result.current.retry(); oldSave = result.current.updateEnabled(true); });
  const next = new FakeGuestAccessGateway();
  const nextSettings = deferred<GuestAccessSettings>();
  const nextPage = deferred<GuestAccessDirectoryPage>();
  next.getSettings.mockReturnValueOnce(nextSettings.promise);
  next.listDirectory.mockReturnValueOnce(nextPage.promise);
  rerender({ gateway: next });
  await act(async () => {
    if (failure) { read.reject(new Error("old read")); save.reject(new Error("old save")); }
    else { read.resolve(desktopPage([laterFile()])); save.resolve({ enabled: true }); }
    await Promise.all([oldRead, oldSave]);
  });
  expect(result.current.settings).toBeNull();
  expect(result.current.page).toBeNull();
  expect(result.current.settingsBusy).toBe(false);
  expect(result.current.loading).toBe(true);
  expect(result.current.error).toBeNull();
  await act(async () => {
    nextSettings.resolve({ enabled: false }); nextPage.resolve(desktopPage(next.items));
    await Promise.all([nextSettings.promise, nextPage.promise]);
  });
  expect(result.current.loading).toBe(false);
});

it.each(["gateway", "unmount"])("invalidates pending publication and queued refresh on %s", async (change) => {
  const { api, result, rerender, unmount } = await mount();
  const save = deferred<GuestPublicationMutationResult>();
  api.setEntryPublished.mockReturnValueOnce(save.promise);
  act(() => { result.current.requestPublicationChange(desktopFile()); void result.current.retry(); });
  const next = new FakeGuestAccessGateway();
  if (change === "gateway") rerender({ gateway: next });
  else unmount();
  await act(async () => { save.resolve({ entryId: "readme", publicationState: GUEST_PUBLICATION_STATE.PUBLIC, affectedCount: 1 }); await save.promise; });
  expect(api.listDirectory).toHaveBeenCalledTimes(1);
  if (change === "gateway") {
    expect(result.current.page?.items).toEqual(next.items);
    expect(result.current.entryBusyId).toBeNull();
    expect(next.listDirectory).toHaveBeenCalledTimes(1);
  }
});

it("ignores initial read failures after unmount and stale callbacks cannot write", async () => {
  const api = new FakeGuestAccessGateway();
  const read = deferred<GuestAccessSettings>();
  const page = deferred<GuestAccessDirectoryPage>();
  api.getSettings.mockReturnValueOnce(read.promise);
  api.listDirectory.mockReturnValueOnce(page.promise);
  const { result, unmount } = renderHook(() => useGuestAccessAdmin(api));
  const controller = result.current;
  unmount();
  await act(async () => {
    read.reject(new Error("disposed settings")); page.reject(new Error("disposed page"));
    await expect(read.promise).rejects.toThrow("disposed settings");
    await expect(page.promise).rejects.toThrow("disposed page");
    await controller.retry(); await controller.updateEnabled(true);
    controller.navigate("photos"); controller.requestPublicationChange(desktopFile());
  });
  expect(api.getSettings).toHaveBeenCalledTimes(1);
  expect(api.listDirectory).toHaveBeenCalledTimes(1);
  expect(api.updateSettings).not.toHaveBeenCalled();
  expect(api.setEntryPublished).not.toHaveBeenCalled();
});

it("does not reactivate old request tokens during StrictMode effect replay", async () => {
  const api = new FakeGuestAccessGateway();
  const old = deferred<GuestAccessSettings>();
  api.getSettings.mockReturnValueOnce(old.promise);
  const { result } = renderHook(() => useGuestAccessAdmin(api), { wrapper: StrictMode });
  await act(async () => {
    await api.getSettings.mock.results[1]!.value;
    old.resolve({ enabled: true }); await old.promise;
  });
  expect(result.current.settings).toEqual({ enabled: false });
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBeNull();
});
