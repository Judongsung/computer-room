import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { WidgetFileDocument } from "@/types/widgets/widget-file";
import { MobileWidgetFileScreen } from "@client/components/mobile/widgets/mobile-widget-file-screen";
import { widgetEntry } from "@test/support/mobile/mobile-app-test-helpers";
import { checklistWidget } from "@test/support/widgets/dashboard-fixtures";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { deferred } from "@test/support/widgets/deferred";

describe("mobile checklist synchronization", () => {
  it.each(["success", "failure"] as const)("ignores a stale read's %s after saving", async (outcome) => {
    const base = checklistWidget("checklist", 0);
    if (base.type !== WIDGET_TYPE.DAILY_CHECKLIST) throw new Error("Expected checklist");
    const item = { id: "item", label: "물 마시기", checked: false };
    const original: WidgetFileDocument = {
      entry: { ...widgetEntry(), widgetId: base.id, widgetType: base.type },
      widget: { ...base, data: { ...base.data, nextResetAt: "2099-01-01T00:00:00.000Z", items: [item] } },
    };
    const saved: WidgetFileDocument = {
      ...original,
      widget: { ...base, data: { ...base.data, nextResetAt: "2099-01-01T00:00:00.000Z", items: [{ ...item, checked: true }] } },
    };
    const stale = deferred<WidgetFileDocument>();
    const getWidgetFile = vi.fn().mockResolvedValue(saved)
      .mockResolvedValueOnce(original).mockImplementationOnce(() => stale.promise);
    const dashboard = new FakeDashboardGateway();
    dashboard.setChecklistItemChecked = vi.fn(async () => ({ ...item, checked: true }));
    render(<MobileWidgetFileScreen entryId={original.entry.id} title={original.entry.name}
      dashboard={dashboard} widgetFiles={{ getWidgetFile, createWidgetFile: vi.fn() }} onDirtyChange={vi.fn()} />);
    const checkbox = await screen.findByRole("checkbox", { name: item.label });
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(getWidgetFile).toHaveBeenCalledTimes(2));
    await userEvent.setup().click(checkbox);
    await waitFor(() => expect(checkbox).toBeChecked());
    await act(async () => {
      if (outcome === "success") stale.resolve(original);
      else stale.reject(new Error("stale failure"));
    });
    expect(checkbox).toBeChecked();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("deduplicates focus and visibility and preserves failed edit input after the queued refresh", async () => {
    const { original, dashboard, getWidgetFile, props } = setup();
    const load = deferred<WidgetFileDocument>();
    const save = deferred<never>();
    getWidgetFile.mockImplementationOnce(() => load.promise);
    dashboard.addChecklistItem = vi.fn(() => save.promise);
    render(<MobileWidgetFileScreen {...props} />);
    act(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
    expect(getWidgetFile).toHaveBeenCalledTimes(1);
    await act(async () => load.resolve(original));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "편집" }));
    const input = screen.getByRole("textbox", { name: "새 체크 항목" });
    await user.type(input, "추가할 항목");
    await user.click(screen.getByRole("button", { name: "항목 추가" }));
    act(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
    expect(getWidgetFile).toHaveBeenCalledTimes(1);
    await act(async () => save.reject(new Error("저장 실패")));
    expect(getWidgetFile).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert")).toHaveTextContent("저장 실패");
    expect(input).toHaveValue("추가할 항목");
    expect(input).toBeEnabled();
  });

  it("adds, renames and deletes using the latest list without unnecessary reads", async () => {
    const { dashboard, getWidgetFile, props } = setup();
    const added = { id: "added", label: "추가", checked: false };
    dashboard.addChecklistItem = vi.fn(async () => added);
    dashboard.updateChecklistItem = vi.fn(async (_id, id, label) => ({ ...added, id, label }));
    dashboard.deleteChecklistItem = vi.fn(async () => undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MobileWidgetFileScreen {...props} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "편집" }));
    const input = screen.getByRole("textbox", { name: "새 체크 항목" });
    await user.type(input, added.label);
    await user.click(screen.getByRole("button", { name: "항목 추가" }));
    expect(await screen.findByRole("checkbox", { name: added.label })).toBeInTheDocument();
    expect(input).toHaveValue("");
    await user.click(screen.getAllByRole("button", { name: "수정" })[1]!);
    const rename = screen.getByRole("textbox", { name: "수정" });
    await user.clear(rename); await user.type(rename, "변경");
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByRole("checkbox", { name: "변경" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "삭제" })[0]!);
    expect(screen.queryByRole("checkbox", { name: "기존" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "변경" })).toBeInTheDocument();
    expect(getWidgetFile).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it.each(["target", "gateway"])("protects the new screen when the %s changes during saving", async (change) => {
    const { props, original, dashboard, getWidgetFile } = setup();
    const save = deferred<{ id: string; label: string; checked: boolean }>();
    dashboard.setChecklistItemChecked = vi.fn(() => save.promise);
    const { rerender } = render(<MobileWidgetFileScreen {...props} />);
    await userEvent.setup().click(await screen.findByRole("checkbox", { name: "기존" }));
    const fresh = deferred<WidgetFileDocument>();
    const nextFiles = { ...props.widgetFiles, getWidgetFile: vi.fn(() => fresh.promise) };
    if (change === "target") getWidgetFile.mockImplementation(() => fresh.promise);
    rerender(<MobileWidgetFileScreen {...props} entryId={change === "target" ? "next" : props.entryId}
      widgetFiles={change === "target" ? props.widgetFiles : nextFiles} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await act(async () => save.resolve({ id: "item", label: "오래된 항목", checked: true }));
    expect(screen.getByText("연결하는 중…")).toBeInTheDocument();
    await act(async () => fresh.resolve(original));
    expect(screen.getByRole("checkbox", { name: "기존" })).not.toBeChecked();
    expect(screen.getByRole("checkbox")).toBeEnabled();
    expect(screen.queryByText("오래된 항목")).not.toBeInTheDocument();
  });

});

function setup() {
  const base = checklistWidget("checklist", 0);
  if (base.type !== WIDGET_TYPE.DAILY_CHECKLIST) throw new Error("Expected checklist");
  const original: WidgetFileDocument = {
    entry: { ...widgetEntry(), widgetId: base.id, widgetType: base.type },
    widget: { ...base, data: { ...base.data, nextResetAt: "2099-01-01T00:00:00.000Z", items: [{ id: "item", label: "기존", checked: false }] } },
  };
  const dashboard = new FakeDashboardGateway();
  const getWidgetFile = vi.fn<() => Promise<WidgetFileDocument>>().mockResolvedValue(original);
  const props = { entryId: original.entry.id, title: original.entry.name, dashboard,
    widgetFiles: { getWidgetFile, createWidgetFile: vi.fn() }, onDirtyChange: vi.fn() };
  return { original, dashboard, getWidgetFile, props };
}
