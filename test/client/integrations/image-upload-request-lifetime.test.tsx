import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IMAGE_UPLOAD_LOG_OUTCOME } from "@/constants/integrations/image-upload-log";
import type { ImageUploadLog, ImageUploadLogPage } from "@/types/integrations/image-upload-log";
import { useImageUploadLogs } from "@client/hooks/integrations/use-image-upload-logs";
import { useImageUploadLogSettings } from "@client/hooks/integrations/use-image-upload-log-settings";
import type { ImageUploadLogGateway } from "@client/types/integrations/image-upload-log";
import { deferred } from "@test/support/widgets/deferred";

describe("useImageUploadLogs", () => {
  it("invalidates old filters, gateways, and inactive tab responses", async () => {
    const old = deferred<ImageUploadLogPage>();
    const filtered = deferred<ImageUploadLogPage>();
    const reopened = deferred<ImageUploadLogPage>();
    const listImageUploadLogs = vi.fn()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(filtered.promise)
      .mockReturnValueOnce(reopened.promise);
    const gateway = logGateway({ listImageUploadLogs });
    const { result, rerender } = renderHook(
      ({ enabled }) => useImageUploadLogs(gateway, enabled),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(listImageUploadLogs).toHaveBeenCalledOnce());
    act(() => result.current.setOutcome(IMAGE_UPLOAD_LOG_OUTCOME.FAILURE));
    await waitFor(() => expect(listImageUploadLogs).toHaveBeenCalledTimes(2));
    await act(async () => old.resolve(page([log("old")])));
    expect(result.current.items).toEqual([]);
    await act(async () => filtered.resolve(page([log("filtered")])));
    expect(result.current.items.map(({ id }) => id)).toEqual(["filtered"]);

    rerender({ enabled: false });
    expect(result.current.items).toEqual([]);
    expect(result.current.outcome).toBe(IMAGE_UPLOAD_LOG_OUTCOME.FAILURE);
    rerender({ enabled: true });
    await waitFor(() => expect(listImageUploadLogs).toHaveBeenCalledTimes(3));
    expect(listImageUploadLogs).toHaveBeenLastCalledWith({ outcome: IMAGE_UPLOAD_LOG_OUTCOME.FAILURE });
    await act(async () => reopened.resolve(page([log("reopened")])));
    expect(result.current.items.map(({ id }) => id)).toEqual(["reopened"]);
  });

  it("serializes append, deduplicates IDs, and lets refresh replace an old append", async () => {
    const staleAppend = deferred<ImageUploadLogPage>();
    const refresh = deferred<ImageUploadLogPage>();
    const listImageUploadLogs = vi.fn()
      .mockResolvedValueOnce(page([log("first")], "cursor"))
      .mockResolvedValueOnce(page([log("first"), log("second")], "cursor-2"))
      .mockReturnValueOnce(staleAppend.promise)
      .mockReturnValueOnce(refresh.promise);
    const gateway = logGateway({ listImageUploadLogs });
    const { result } = renderHook(() => useImageUploadLogs(gateway, true));
    await waitFor(() => expect(result.current.nextCursor).toBe("cursor"));
    act(() => {
      void result.current.loadMore();
      void result.current.loadMore();
    });
    await waitFor(() => expect(result.current.items.map(({ id }) => id)).toEqual(["first", "second"]));
    expect(listImageUploadLogs).toHaveBeenCalledTimes(2);
    act(() => { void result.current.loadMore(); });
    act(() => { void result.current.refresh(); });
    expect(listImageUploadLogs).toHaveBeenCalledTimes(4);
    await act(async () => refresh.resolve(page([log("fresh")], "next")));
    await act(async () => staleAppend.resolve(page([log("old append")], null)));
    expect(result.current.items.map(({ id }) => id)).toEqual(["fresh"]);
    expect(result.current.nextCursor).toBe("next");
  });
});

describe("useImageUploadLogSettings", () => {
  it("blocks save after a failed load and allows a retry", async () => {
    const getImageUploadLogSettings = vi.fn()
      .mockRejectedValueOnce(new Error("load failed"))
      .mockResolvedValueOnce({ retentionDays: 45 });
    const updateImageUploadLogRetentionDays = vi.fn(async (retentionDays: number) => ({ retentionDays }));
    const gateway = logGateway({ getImageUploadLogSettings, updateImageUploadLogRetentionDays });
    const { result } = renderHook(() => useImageUploadLogSettings(gateway, true));
    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(updateImageUploadLogRetentionDays).not.toHaveBeenCalled();
    await act(async () => result.current.load());
    expect(result.current.retentionDays).toBe(45);
    expect(result.current.canSave).toBe(true);
  });

  it("shares the read/save lock and ignores a save completed after tab exit", async () => {
    const save = deferred<{ retentionDays: number }>();
    const updateImageUploadLogRetentionDays = vi.fn(() => save.promise);
    const gateway = logGateway({
      getImageUploadLogSettings: vi.fn(async () => ({ retentionDays: 30 })),
      updateImageUploadLogRetentionDays,
    });
    const { result, rerender } = renderHook(
      ({ enabled }) => useImageUploadLogSettings(gateway, enabled),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.canSave).toBe(true));
    act(() => result.current.setDraft("90"));
    let accepted!: Promise<boolean>;
    let ignored!: Promise<boolean>;
    act(() => {
      accepted = result.current.save();
      ignored = result.current.save();
      void result.current.load();
    });
    expect(updateImageUploadLogRetentionDays).toHaveBeenCalledOnce();
    await expect(ignored).resolves.toBe(false);
    rerender({ enabled: false });
    await act(async () => save.resolve({ retentionDays: 90 }));
    await expect(accepted).resolves.toBe(false);
    expect(result.current.retentionDays).toBe(30);
  });
});

function log(id: string): ImageUploadLog {
  return {
    id, profileId: null, sourceIp: null,
    outcome: IMAGE_UPLOAD_LOG_OUTCOME.FAILURE,
    contentType: null, declaredSize: null, fileName: null, file: null,
    httpStatus: 400, error: { code: "FAILED", message: "failed" },
    receivedAt: "2026-09-09T00:00:00.000Z", durationMs: 1,
  };
}

function page(items: readonly ImageUploadLog[], nextCursor: string | null = null): ImageUploadLogPage {
  return { items, nextCursor };
}

function logGateway(overrides: Partial<ImageUploadLogGateway>): ImageUploadLogGateway {
  return {
    listImageUploadLogs: async () => page([]),
    getImageUploadLogSettings: async () => ({ retentionDays: 30 }),
    updateImageUploadLogRetentionDays: async (retentionDays) => ({ retentionDays }),
    ...overrides,
  };
}
