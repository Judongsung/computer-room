import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { ChecklistItem } from "@/types/widgets/widget";
import { useDailyChecklistController } from "@client/hooks/widgets/checklist/use-daily-checklist-controller";
import { checklistWidget } from "@test/support/widgets/dashboard-fixtures";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { deferred } from "@test/support/widgets/deferred";

describe("desktop checklist coordination", () => {
  it("preserves latest metadata and other items when an optimistic toggle rolls back", async () => {
    const widget = fixture();
    const gateway = new FakeDashboardGateway();
    const save = deferred<ChecklistItem>();
    gateway.setChecklistItemChecked = vi.fn(() => save.promise);
    const onWidgetChange = vi.fn();
    const { result, rerender } = renderHook((props) => useDailyChecklistController(props), {
      initialProps: { widget, gateway, onWidgetChange },
    });
    act(() => { void result.current.toggleItem(widget.data.items[0]!, true); });
    expect(onWidgetChange.mock.lastCall?.[0].data.items[0].checked).toBe(true);
    const latest = { ...widget, title: "최근 제목", data: { ...widget.data, items: [
      { ...widget.data.items[0]!, checked: true }, { id: "other", label: "다른 항목", checked: false },
    ] } };
    rerender({ widget: latest, gateway, onWidgetChange });
    await act(async () => save.reject(new Error("저장 실패")));
    expect(onWidgetChange.mock.lastCall?.[0]).toEqual({ ...latest, data: {
      ...latest.data, items: [widget.data.items[0], latest.data.items[1]],
    } });
    expect(result.current.error).toBe("저장 실패");
  });

  it("ignores old read failures after saving and starts one queued refresh", async () => {
    const widget = fixture();
    const gateway = new FakeDashboardGateway();
    const old = deferred<typeof widget.data>();
    const fresh = deferred<typeof widget.data>();
    gateway.getChecklist = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const updated = { ...widget.data.items[0]!, checked: true };
    gateway.setChecklistItemChecked = vi.fn(async () => updated);
    const onWidgetChange = vi.fn();
    const { result } = renderHook(() => useDailyChecklistController({ widget, gateway, onWidgetChange }));
    act(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
    expect(gateway.getChecklist).toHaveBeenCalledTimes(1);
    await act(async () => result.current.toggleItem(widget.data.items[0]!, true));
    expect(gateway.getChecklist).toHaveBeenCalledTimes(2);
    await act(async () => old.reject(new Error("오래된 오류")));
    expect(result.current.error).toBeNull();
    expect(onWidgetChange.mock.lastCall?.[0].data.items).toEqual([updated]);
    await act(async () => fresh.resolve({ ...widget.data, items: [updated] }));
    expect(result.current.error).toBeNull();
  });
});

function fixture() {
  const base = checklistWidget("checklist", 0);
  if (base.type !== WIDGET_TYPE.DAILY_CHECKLIST) throw new Error("Expected checklist");
  return { ...base, data: { ...base.data, nextResetAt: "2099-01-01T00:00:00.000Z",
    items: [{ id: "item", label: "항목", checked: false }] } };
}
