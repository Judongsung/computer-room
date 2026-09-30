import { StrictMode, useLayoutEffect } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WINDOW_STATE } from "@/constants/widgets/widget";
import { toWidgetLayout } from "@/domain/widgets/widget-layout";
import type { DashboardWidget, WidgetLayout } from "@/types/widgets/widget";
import { LAYOUT_SAVE_DEBOUNCE_MILLISECONDS, LAYOUT_SAVE_STATUS } from "@client/constants/desktop/layout-save";
import { useWidgetLayoutAutoSave } from "@client/hooks/widgets/use-widget-layout-auto-save";
import { memoWidget } from "@test/support/widgets/dashboard-fixtures";
import { fakeWidgetFromLayout } from "@test/support/widgets/fake-dashboard-gateway";
import { deferred } from "@test/support/widgets/deferred";

const MEMO = memoWidget("memo");
const NEXT = { ...MEMO, windowState: WINDOW_STATE.MINIMIZED };

function gateway() {
  return {
    listWidgets: vi.fn(async (): Promise<DashboardWidget[]> => []),
    replaceWidgets: vi.fn(async (widgets: readonly WidgetLayout[]) => widgets.map(fakeWidgetFromLayout)),
  };
}

function options() { return { onSaved: vi.fn(), fallbackErrorMessage: "save failed" }; }
async function advance(milliseconds = LAYOUT_SAVE_DEBOUNCE_MILLISECONDS) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it("debounces to the latest snapshot and publishes saved state", async () => {
  const api = gateway();
  const callbacks = options();
  const { result } = renderHook(() => useWidgetLayoutAutoSave(api, callbacks));
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.IDLE);
  expect(result.current.hasUnsavedChanges).toBe(false);
  act(() => { result.current.schedule([MEMO]); });
  await advance(200);
  act(() => { result.current.schedule([NEXT]); });
  await advance(249);
  expect(api.replaceWidgets).not.toHaveBeenCalled();
  expect(result.current.hasUnsavedChanges).toBe(true);
  await advance(1);
  expect(api.replaceWidgets).toHaveBeenCalledTimes(1);
  expect(api.replaceWidgets.mock.calls[0]![0]).toEqual([toWidgetLayout(NEXT)]);
  expect(callbacks.onSaved).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.SAVED);
  expect(result.current.error).toBeNull();
  expect(result.current.hasUnsavedChanges).toBe(false);
});

it("serializes saves and drains only the latest queued snapshot without leftover timers", async () => {
  const api = gateway();
  const callbacks = options();
  const first = deferred<DashboardWidget[]>();
  api.replaceWidgets.mockReturnValueOnce(first.promise);
  const { result } = renderHook(() => useWidgetLayoutAutoSave(api, callbacks));
  act(() => { result.current.schedule([MEMO]); });
  await advance();
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.SAVING);
  act(() => { result.current.schedule([{ ...MEMO, windowState: WINDOW_STATE.MAXIMIZED }]); result.current.schedule([NEXT]); });
  await advance();
  expect(api.replaceWidgets).toHaveBeenCalledTimes(1);
  await act(async () => { first.resolve([MEMO]); await first.promise; });
  expect(api.replaceWidgets).toHaveBeenCalledTimes(2);
  expect(api.replaceWidgets.mock.calls[1]![0]).toEqual([toWidgetLayout(NEXT)]);
  expect(callbacks.onSaved).toHaveBeenCalledTimes(2);
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.SAVED);
  expect(vi.getTimerCount()).toBe(0);
});

it("retains the failed snapshot for manual retry", async () => {
  const api = gateway();
  api.replaceWidgets.mockRejectedValueOnce(new Error("write failed"));
  const { result } = renderHook(() => useWidgetLayoutAutoSave(api, options()));
  act(() => { result.current.schedule([MEMO]); });
  await advance();
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.ERROR);
  expect(result.current.error).toBe("write failed");
  expect(result.current.hasUnsavedChanges).toBe(true);
  act(() => { result.current.retry(); });
  await act(async () => { await api.replaceWidgets.mock.results[1]!.value; });
  expect(api.replaceWidgets.mock.calls[1]![0]).toEqual(api.replaceWidgets.mock.calls[0]![0]);
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.SAVED);
  expect(result.current.error).toBeNull();
});

it("preserves the newest queued snapshot on failure and pauses its timer until manual retry", async () => {
  const api = gateway();
  const first = deferred<DashboardWidget[]>();
  api.replaceWidgets.mockReturnValueOnce(first.promise);
  const { result } = renderHook(() => useWidgetLayoutAutoSave(api, options()));
  act(() => { result.current.schedule([MEMO]); });
  await advance();
  act(() => { result.current.schedule([NEXT]); });
  await act(async () => { first.reject(new Error("old save failed")); await expect(first.promise).rejects.toThrow("old save failed"); });
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.ERROR);
  await advance(1000);
  expect(api.replaceWidgets).toHaveBeenCalledTimes(1);
  act(() => { result.current.retry(); });
  await act(async () => { await api.replaceWidgets.mock.results[1]!.value; });
  expect(api.replaceWidgets.mock.calls[1]![0]).toEqual([toWidgetLayout(NEXT)]);
  expect(result.current.hasUnsavedChanges).toBe(false);
});

it("copies snapshots and forgets queued IDs while normalizing stack orders", async () => {
  const api = gateway();
  const source = { ...MEMO, position: { x: 10, y: 20 }, size: { width: 400, height: 300 }, stackOrder: 20 };
  const removed = { ...memoWidget("removed"), stackOrder: 10 };
  const last = { ...memoWidget("last"), stackOrder: 30 };
  const { result } = renderHook(() => useWidgetLayoutAutoSave(api, options()));
  act(() => { result.current.schedule([source, removed, last]); result.current.forget([removed.id]); });
  source.position.x = 99;
  source.size.width = 999;
  await advance();
  expect(api.replaceWidgets.mock.calls[0]![0]).toMatchObject([
    { id: MEMO.id, position: { x: 10, y: 20 }, size: { width: 400, height: 300 }, stackOrder: 0 },
    { id: last.id, stackOrder: 1 },
  ]);
  expect(source.stackOrder).toBe(20);
  expect(removed.stackOrder).toBe(10);
});

it("discards the old pending timer and rejects disposed controller calls after gateway replacement", async () => {
  const api = gateway();
  const next = gateway();
  const callbacks = options();
  const { result, rerender } = renderHook(({ api: port }) => useWidgetLayoutAutoSave(port, callbacks), { initialProps: { api } });
  const old = result.current;
  act(() => { old.schedule([MEMO]); });
  await advance(100);
  rerender({ api: next });
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.IDLE);
  expect(result.current.hasUnsavedChanges).toBe(false);
  act(() => { old.schedule([NEXT]); old.retry(); old.forget([MEMO.id]); result.current.retry(); });
  await advance(1000);
  expect(api.replaceWidgets).not.toHaveBeenCalled();
  expect(next.replaceWidgets).not.toHaveBeenCalled();
  act(() => { result.current.schedule([NEXT]); });
  await advance();
  expect(next.replaceWidgets.mock.calls[0]![0]).toEqual([toWidgetLayout(NEXT)]);
  expect(callbacks.onSaved).toHaveBeenCalledTimes(1);
});

it.each([false, true])("ignores the old save and queue while the new gateway saves independently (failure=%s)", async (failure) => {
  const api = gateway();
  const next = gateway();
  const oldSave = deferred<DashboardWidget[]>();
  const newSave = deferred<DashboardWidget[]>();
  api.replaceWidgets.mockReturnValueOnce(oldSave.promise);
  next.replaceWidgets.mockReturnValueOnce(newSave.promise);
  const oldOptions = options();
  const newOptions = options();
  const { result, rerender } = renderHook(({ api: port, callbacks }) => useWidgetLayoutAutoSave(port, callbacks), { initialProps: { api, callbacks: oldOptions } });
  act(() => { result.current.schedule([MEMO]); });
  await advance();
  const oldController = result.current;
  act(() => { oldController.schedule([NEXT]); });
  rerender({ api: next, callbacks: newOptions });
  act(() => { result.current.schedule([NEXT]); });
  await advance();
  expect(next.replaceWidgets).toHaveBeenCalledTimes(1);
  await act(async () => {
    if (failure) { oldSave.reject(new Error("old gateway")); await expect(oldSave.promise).rejects.toThrow("old gateway"); }
    else { oldSave.resolve([MEMO]); await oldSave.promise; }
  });
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.SAVING);
  expect(result.current.error).toBeNull();
  expect(oldOptions.onSaved).not.toHaveBeenCalled();
  expect(newOptions.onSaved).not.toHaveBeenCalled();
  act(() => { oldController.retry(); });
  await act(async () => { newSave.resolve([NEXT]); await newSave.promise; });
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.SAVED);
  expect(newOptions.onSaved).toHaveBeenCalledWith([NEXT]);
  expect(api.replaceWidgets).toHaveBeenCalledTimes(1);
  expect(next.replaceWidgets).toHaveBeenCalledTimes(1);
  await advance(1000);
  expect(api.replaceWidgets).toHaveBeenCalledTimes(1);
});

it("discards a failed snapshot on gateway change rather than retrying it on either gateway", async () => {
  const api = gateway();
  const next = gateway();
  api.replaceWidgets.mockRejectedValueOnce(new Error("failed"));
  const { result, rerender } = renderHook(({ api: port }) => useWidgetLayoutAutoSave(port, options()), { initialProps: { api } });
  act(() => { result.current.schedule([MEMO]); });
  await advance();
  expect(result.current.error).toBe("failed");
  rerender({ api: next });
  act(() => { result.current.retry(); });
  await advance();
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.IDLE);
  expect(result.current.error).toBeNull();
  expect(api.replaceWidgets).toHaveBeenCalledTimes(1);
  expect(next.replaceWidgets).not.toHaveBeenCalled();
});

it("uses current options without resetting a pending debounce or in-flight save", async () => {
  const api = gateway();
  const old = options();
  const updated = options();
  const latest = options();
  const save = deferred<DashboardWidget[]>();
  api.replaceWidgets.mockReturnValueOnce(save.promise);
  const { result, rerender } = renderHook(({ callbacks }) => useWidgetLayoutAutoSave(api, callbacks), { initialProps: { callbacks: old } });
  act(() => { result.current.schedule([MEMO]); });
  await advance(200);
  rerender({ callbacks: updated });
  await advance(50);
  expect(api.replaceWidgets).toHaveBeenCalledTimes(1);
  rerender({ callbacks: latest });
  await act(async () => { save.resolve([MEMO]); await save.promise; });
  expect(old.onSaved).not.toHaveBeenCalled();
  expect(updated.onSaved).not.toHaveBeenCalled();
  expect(latest.onSaved).toHaveBeenCalledWith([MEMO]);
  expect(api.replaceWidgets).toHaveBeenCalledTimes(1);
});

it("uses the current fallback when an in-flight failure has no error message", async () => {
  const api = gateway();
  const save = deferred<DashboardWidget[]>();
  api.replaceWidgets.mockReturnValueOnce(save.promise);
  const callbacks = options();
  const { result, rerender } = renderHook(({ callbacks: current }) => useWidgetLayoutAutoSave(api, current), { initialProps: { callbacks } });
  act(() => { result.current.schedule([MEMO]); });
  await advance();
  rerender({ callbacks: { ...callbacks, fallbackErrorMessage: "current fallback" } });
  await act(async () => { save.reject(null); await expect(save.promise).rejects.toBeNull(); });
  expect(result.current.error).toBe("current fallback");
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.ERROR);
});

it.each([false, true])("stops in-flight completion and queued saves after unmount (failure=%s)", async (failure) => {
  const api = gateway();
  const callbacks = options();
  const save = deferred<DashboardWidget[]>();
  api.replaceWidgets.mockReturnValueOnce(save.promise);
  const { result, unmount } = renderHook(() => useWidgetLayoutAutoSave(api, callbacks));
  act(() => { result.current.schedule([MEMO]); });
  await advance();
  const controller = result.current;
  act(() => { controller.schedule([NEXT]); });
  unmount();
  act(() => { controller.retry(); controller.schedule([NEXT]); controller.forget([MEMO.id]); });
  await act(async () => {
    if (failure) { save.reject(new Error("disposed")); await expect(save.promise).rejects.toThrow("disposed"); }
    else { save.resolve([MEMO]); await save.promise; }
  });
  await advance(1000);
  expect(api.replaceWidgets).toHaveBeenCalledTimes(1);
  expect(callbacks.onSaved).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels a debounce timer on unmount", async () => {
  const api = gateway();
  const { result, unmount } = renderHook(() => useWidgetLayoutAutoSave(api, options()));
  act(() => { result.current.schedule([MEMO]); });
  unmount();
  await advance(1000);
  expect(api.replaceWidgets).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("does not reactivate a StrictMode save token when its effect is replayed", async () => {
  const api = gateway();
  const callbacks = options();
  const first = deferred<DashboardWidget[]>();
  const second = deferred<DashboardWidget[]>();
  api.replaceWidgets.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result } = renderHook(() => {
    const controller = useWidgetLayoutAutoSave(api, callbacks);
    useLayoutEffect(() => { controller.schedule([MEMO]); controller.retry(); }, [controller.schedule, controller.retry]);
    return controller;
  }, { wrapper: StrictMode });
  expect(api.replaceWidgets).toHaveBeenCalledTimes(2);
  await act(async () => { first.resolve([NEXT]); await first.promise; });
  expect(callbacks.onSaved).not.toHaveBeenCalled();
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.SAVING);
  await act(async () => { second.resolve([MEMO]); await second.promise; });
  expect(callbacks.onSaved).toHaveBeenCalledTimes(1);
  expect(callbacks.onSaved).toHaveBeenCalledWith([MEMO]);
  expect(result.current.status).toBe(LAYOUT_SAVE_STATUS.SAVED);
});
