import { fakeChecklistRetentionGateway } from "@test/support/widgets/checklist-retention-gateway";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { ChecklistItem, DailyChecklistData, DailyChecklistWidget as DailyChecklistWidgetData } from "@/types/widgets/widget";
import { DailyChecklistWidget } from "@client/components/widgets/daily-checklist-widget";

import type { ChecklistGateway } from "@client/types/widgets/ports/checklist";
import type { WidgetWindowControls } from "@client/types/desktop/window";
import { checklistWidget } from "@test/support/widgets/dashboard-fixtures";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";

describe("DailyChecklistWidget", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rolls back an optimistic check when the mutation fails", async () => {
    const item = { id: "item", label: "물 마시기", checked: false } as const;
    const widget = widgetWithData({ items: [item] });
    const gateway = new FakeDashboardGateway();
    const pending = deferred<ChecklistItem>();
    gateway.setChecklistItemChecked = vi.fn(() => pending.promise);
    const user = userEvent.setup();
    render(<ChecklistHarness widget={widget} gateway={gateway} />);

    const checkbox = screen.getByRole("checkbox", { name: item.label });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await act(async () => pending.reject(new Error("toggle failed")));

    expect(await screen.findByRole("alert")).toHaveTextContent("toggle failed");
    expect(checkbox).not.toBeChecked();
  });

  it("changes repeat cycle and preserves the displayed completion timestamp", async () => {
    const widget = widgetWithData({items:[{id:"dated", label:"기록", checked:true, checkedAt:"2026-09-06T05:35:00Z"}]});
    const gateway = new FakeDashboardGateway();
    gateway.changeChecklistRepeatCycle = vi.fn(async (_id, repeatCycle) => ({...widget.data, repeatCycle}));
    const user = userEvent.setup();
    render(<ChecklistHarness widget={widget} gateway={gateway} />);
    expect(screen.getByText("2026-09-06 14:35")).toBeInTheDocument();
    await user.click(screen.getByRole("button", {name:"반복 설정"}));
    await user.selectOptions(screen.getByRole("combobox", {name:"반복 주기"}), "monthly");
    await user.click(screen.getByRole("button", {name:"저장"}));
    expect(gateway.changeChecklistRepeatCycle).toHaveBeenCalledWith(widget.id,"monthly");
    expect(await screen.findByText("월간")).toBeInTheDocument();
    expect(screen.getByText("2026-09-06 14:35")).toBeInTheDocument();
  });

  it("refreshes checklist data when the page regains focus", async () => {
    const item = { id: "focused", label: "다시 불러온 항목", checked: false } as const;
    const widget = widgetWithData({ items: [] });
    const gateway = new FakeDashboardGateway();
    gateway.getChecklist = vi.fn(async () => ({
      ...widget.data,
      items: [item],
    }));
    render(<ChecklistHarness widget={widget} gateway={gateway} />);

    act(() => window.dispatchEvent(new Event("focus")));

    expect(
      await screen.findByRole("checkbox", { name: item.label }),
    ).toBeInTheDocument();
    expect(gateway.getChecklist).toHaveBeenCalledWith(widget.id);
  });

  it("waits through the browser timer limit before a monthly boundary", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-10-01T00:00:00+09:00");
    vi.setSystemTime(now);
    const day = 86_400_000;
    const widget = widgetWithData({ repeatCycle: "monthly", nextResetAt: new Date(now + 31 * day).toISOString() });
    const gateway = new FakeDashboardGateway();
    gateway.getChecklist = vi.fn(async () => ({ ...widget.data, nextResetAt: new Date(now + 61 * day).toISOString() }));
    render(<ChecklistHarness widget={widget} gateway={gateway} />);
    await act(async () => vi.advanceTimersByTimeAsync(25 * day));
    expect(gateway.getChecklist).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(6 * day + 1000));
    expect(gateway.getChecklist).toHaveBeenCalledTimes(1);
  });

  it("refreshes after the configured reset time", async () => {
    vi.useFakeTimers();
    const now = Date.UTC(2026, 7, 20, 14, 59, 50);
    vi.setSystemTime(now);
    const widget = widgetWithData({
      items: [],
      nextResetAt: new Date(now + 5_000).toISOString(),
    });
    const gateway = new FakeDashboardGateway();
    gateway.getChecklist = vi.fn(async () => widget.data);
    render(<ChecklistHarness widget={widget} gateway={gateway} />);

    await act(async () => vi.advanceTimersByTimeAsync(6_000));

    expect(gateway.getChecklist).toHaveBeenCalledWith(widget.id);
  });
});

function ChecklistHarness({
  widget: initialWidget,
  gateway,
}: {
  readonly widget: DailyChecklistWidgetData;
  readonly gateway: ChecklistGateway;
}) {
  const [widget, setWidget] = useState(initialWidget);
  const updateWidget = (next: DailyChecklistWidgetData): void => setWidget(next);
  return (
    <DailyChecklistWidget
      widget={widget}
      gateway={gateway}
      checklistRetentionGateway={fakeChecklistRetentionGateway()}
      windowControls={WINDOW_CONTROLS}
      onWidgetChange={updateWidget}
    />
  );
}

function widgetWithData(
  data: Partial<DailyChecklistData>,
): DailyChecklistWidgetData {
  const widget = checklistWidget("checklist", 0);
  if (widget.type !== WIDGET_TYPE.DAILY_CHECKLIST) {
    throw new Error("Expected checklist fixture.");
  }
  return {
    ...widget,
    data: {
      ...widget.data,
      nextResetAt: "2099-01-01T00:00:00.000Z",
      ...data,
    },
  };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly reject: (reason: unknown) => void;
} {
  let reject = (_reason: unknown): void => undefined;
  const promise = new Promise<T>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

const WINDOW_CONTROLS: WidgetWindowControls = {
  isActive: true,
  isMaximized: false,
  onFocus: vi.fn(),
  onMinimize: vi.fn(),
  onToggleMaximize: vi.fn(),
  onClose: vi.fn(),
  onSaveFile: vi.fn(),
  canSaveFile: false,
};
