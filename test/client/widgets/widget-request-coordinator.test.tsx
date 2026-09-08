import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWidgetRequestCoordinator } from "@client/hooks/widgets/use-widget-request-coordinator";
import { deferred } from "@test/support/widgets/deferred";

describe("widget request coordination", () => {
  it.each(["success", "failure"])("shares reads and ignores stale %s and finalization during a fresh read", async (outcome) => {
    const old = deferred<number>();
    const fresh = deferred<number>();
    const save = deferred<number>();
    const read = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const onRead = vi.fn();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useWidgetRequestCoordinator({ scope, read, onRead }));
    let first!: Promise<void>;
    act(() => { first = result.current.refresh(); expect(result.current.refresh()).toBe(first); });
    let mutation!: Promise<boolean>;
    act(() => { mutation = result.current.mutate({ operation: () => save.promise, onSuccess }); });
    act(() => { void result.current.refresh(); void result.current.refresh(); });
    await act(async () => { save.resolve(2); expect(await mutation).toBe(true); });
    expect(onSuccess).toHaveBeenCalledWith(2);
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.reading).toBe(true);
    await act(async () => { if (outcome === "success") old.resolve(1); else old.reject(new Error("old")); await first; });
    expect(result.current.reading).toBe(true);
    expect(result.current.readError).toBeNull();
    expect(onRead).not.toHaveBeenCalled();
    await act(async () => fresh.resolve(3));
    expect(onRead).toHaveBeenCalledExactlyOnceWith(3);
    expect(result.current.reading).toBe(false);
  });

  it("blocks duplicate writes immediately, preserves failure through queued refresh, and permits retry without extra reads", async () => {
    const save = deferred<number>();
    const failure = new Error("save failed");
    const read = vi.fn(async () => 1);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const operation = vi.fn(() => save.promise);
    const { result } = renderHook(() => useWidgetRequestCoordinator({ scope, read, onRead: vi.fn() }));
    let mutation!: Promise<boolean>;
    await act(async () => {
      mutation = result.current.mutate({ operation, onSuccess, onError });
      expect(await result.current.mutate({ operation, onSuccess })).toBe(false);
      void result.current.refresh(); void result.current.refresh();
    });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();
    await act(async () => { save.reject(failure); expect(await mutation).toBe(false); });
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
    expect(result.current.mutationError?.cause).toBe(failure);
    await act(async () => { expect(await result.current.mutate({ operation: async () => 2, onSuccess })).toBe(true); });
    expect(result.current.mutationError).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("preserves data on a current read failure and clears only that error on retry", async () => {
    const failure = new Error("read failed");
    const read = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(2);
    const onRead = vi.fn();
    const { result } = renderHook(() => useWidgetRequestCoordinator({ scope, read, onRead }));
    await act(async () => result.current.refresh());
    expect(onRead).not.toHaveBeenCalled();
    expect(result.current.readError?.cause).toBe(failure);
    await act(async () => result.current.refresh());
    expect(onRead).toHaveBeenCalledExactlyOnceWith(2);
    expect(result.current.readError).toBeNull();
  });

  it.each(["resolve", "reject"])("invalidates old scope reads, writes and queued work on %s", async (outcome) => {
    const old = deferred<number>();
    const save = deferred<number>();
    const fresh = deferred<number>();
    const read = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const onRead = vi.fn(); const onSuccess = vi.fn(); const onError = vi.fn();
    const { result, rerender, unmount } = renderHook(({ target }) => useWidgetRequestCoordinator({ scope: target, read, onRead }), { initialProps: { target: {} } });
    act(() => { void result.current.refresh(); void result.current.mutate({ operation: () => save.promise, onSuccess, onError }); });
    rerender({ target: {} });
    act(() => { void result.current.refresh(); });
    await act(async () => {
      if (outcome === "resolve") { old.resolve(1); save.resolve(1); }
      else { old.reject(new Error("old")); save.reject(new Error("old")); }
    });
    expect(result.current.reading).toBe(true);
    expect(result.current.mutating).toBe(false);
    expect(result.current.mutationError).toBeNull();
    expect(onRead).not.toHaveBeenCalled(); expect(onSuccess).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => fresh.resolve(2));
    expect(onRead).not.toHaveBeenCalled();
  });
});

const scope = {};
