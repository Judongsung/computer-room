import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChecklistRetention } from "@client/hooks/widgets/checklist/use-checklist-retention";
import { fakeChecklistRetentionGateway } from "@test/support/widgets/checklist-retention-gateway";
import { deferred } from "@test/support/widgets/deferred";
import type { ChecklistRetentionSettings } from "@/types/widgets/checklist/retention";

describe("retention request lifetime", () => {
  it("preserves input after save failure and permits retry", async () => {
    const gateway = fakeChecklistRetentionGateway();
    gateway.updateRetentionDays.mockRejectedValueOnce(new Error("save failed"));
    const { result } = renderHook(() => useChecklistRetention(gateway));
    act(() => result.current.setExpanded(true));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => { result.current.setUnlimited(false); result.current.setDays("90"); });
    await act(() => result.current.save());
    expect(result.current.error).toBe("save failed");
    expect(result.current.days).toBe("90");
    expect(result.current.unlimited).toBe(false);
    await act(() => result.current.save());
    expect(result.current.saved).toBe(true);
    expect(gateway.updateRetentionDays).toHaveBeenLastCalledWith(90);
  });

  it.each(["resolve", "reject"] as const)("ignores a closed load that later %s", async (outcome) => {
    const old = deferred<ChecklistRetentionSettings>();
    const gateway = fakeChecklistRetentionGateway();
    gateway.getSettings.mockReturnValueOnce(old.promise).mockResolvedValue({ retentionDays: 90 });
    const { result } = renderHook(() => useChecklistRetention(gateway));
    act(() => result.current.setExpanded(true));
    act(() => result.current.setExpanded(false));
    act(() => result.current.setExpanded(true));
    await waitFor(() => expect(result.current.days).toBe("90"));
    await act(async () => { if (outcome === "resolve") old.resolve({ retentionDays: 7 }); else old.reject(new Error("old")); });
    expect(result.current.days).toBe("90");
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it("protects the new gateway loading state from an old save", async () => {
    const old = deferred<ChecklistRetentionSettings>();
    const next = deferred<ChecklistRetentionSettings>();
    const gateway = fakeChecklistRetentionGateway();
    const replacement = fakeChecklistRetentionGateway();
    gateway.updateRetentionDays.mockReturnValue(old.promise);
    replacement.getSettings.mockReturnValue(next.promise);
    const { result, rerender } = renderHook(({ port }) => useChecklistRetention(port), { initialProps: { port: gateway } });
    act(() => result.current.setExpanded(true));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    let saving!: Promise<void>;
    act(() => { saving = result.current.save(); });
    rerender({ port: replacement });
    await act(async () => { old.reject(new Error("old save")); await saving; });
    expect(result.current.busy).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.saved).toBe(false);
    await act(async () => next.resolve({ retentionDays: 30 }));
    expect(result.current.days).toBe("30");
  });

  it("ignores an old load after gateway change and unmount", async () => {
    const old = deferred<ChecklistRetentionSettings>();
    const gateway = fakeChecklistRetentionGateway();
    const replacement = fakeChecklistRetentionGateway();
    gateway.getSettings.mockReturnValue(old.promise);
    const { result, rerender, unmount } = renderHook(({ port }) => useChecklistRetention(port), { initialProps: { port: gateway } });
    act(() => result.current.setExpanded(true));
    rerender({ port: replacement });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => old.resolve({ retentionDays: 7 }));
    expect(result.current.unlimited).toBe(true);
    act(() => result.current.setExpanded(false));
    const unmounted = deferred<ChecklistRetentionSettings>();
    replacement.getSettings.mockReturnValue(unmounted.promise);
    act(() => result.current.setExpanded(true));
    unmount();
    await act(async () => unmounted.reject(new Error("unmounted")));
    expect(replacement.getSettings).toHaveBeenCalledTimes(2);
  });
});
