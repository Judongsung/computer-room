import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StorageStatusSnapshot } from "@/types/storage/storage-status";
import { useStorageStatus } from "@client/hooks/storage/use-storage-status";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import { deferred } from "@test/support/widgets/deferred";

describe("useStorageStatus", () => {
  it("shares refreshes and keeps the previous status and error until success", async () => {
    const first = deferred<StorageStatusSnapshot>();
    const failed = deferred<StorageStatusSnapshot>();
    const recovered = deferred<StorageStatusSnapshot>();
    const getStatus = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(failed.promise)
      .mockReturnValueOnce(recovered.promise);
    const gateway = { getStatus };
    const { result } = renderHook(() => useStorageStatus(gateway));
    await waitFor(() => expect(getStatus).toHaveBeenCalledOnce());
    const sharedA = result.current.refresh();
    const sharedB = result.current.refresh();
    expect(sharedA).toBe(sharedB);
    await act(async () => first.resolve(status("first")));
    expect(result.current.status?.measuredAt).toBe("first");

    act(() => { void result.current.refresh(); });
    await act(async () => failed.reject(new Error("refresh failed")));
    expect(result.current.status?.measuredAt).toBe("first");
    expect(result.current.error).toBe("refresh failed");
    act(() => { void result.current.refresh(); });
    expect(result.current.error).toBe("refresh failed");
    await act(async () => recovered.resolve(status("recovered")));
    expect(result.current.status?.measuredAt).toBe("recovered");
    expect(result.current.error).toBeNull();
  });

  it("hides and ignores a previous gateway response", async () => {
    const old = deferred<StorageStatusSnapshot>();
    const fresh = deferred<StorageStatusSnapshot>();
    const oldGateway: StorageStatusGateway = { getStatus: () => old.promise };
    const newGateway: StorageStatusGateway = { getStatus: () => fresh.promise };
    const { result, rerender } = renderHook(
      ({ gateway }) => useStorageStatus(gateway),
      { initialProps: { gateway: oldGateway } },
    );
    rerender({ gateway: newGateway });
    expect(result.current.status).toBeNull();
    await act(async () => old.resolve(status("old")));
    expect(result.current.status).toBeNull();
    await act(async () => fresh.resolve(status("fresh")));
    expect(result.current.status?.measuredAt).toBe("fresh");
  });
});

function status(measuredAt: string): StorageStatusSnapshot {
  return { measuredAt, r2: {}, d1: {} } as StorageStatusSnapshot;
}
