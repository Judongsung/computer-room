import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MAX_OPEN_WIDGET_COUNT,
  WIDGET_TYPE,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import type { WidgetLayout } from "@/types/widgets/widget";
import { UI_MESSAGES } from "@client/content/ko/widgets/dashboard";
import { useDashboard } from "@client/hooks/widgets/use-dashboard";
import {
  checklistWidget,
  memoWidget,
} from "@test/client/support/desktop/app-integration-helpers";
import {
  FakeDashboardGateway,
  fakeWidgetFromLayout,
} from "@test/support/widgets/fake-dashboard-gateway";

const DESKTOP = { width: 1_280, height: 720 } as const;

describe("useDashboard", () => {
  it("focuses an existing singleton instead of creating another widget", async () => {
    const api = new FakeDashboardGateway();
    const storage = fakeWidgetFromLayout(
      layout("storage", WIDGET_TYPE.STORAGE_STATUS, 0),
    );
    api.savedWidgets = [storage, { ...memoWidget("memo"), stackOrder: 1 }];
    const createWidget = vi.spyOn(api, "createWidget");
    const { result } = renderHook(() => useDashboard(api));
    await waitFor(() => expect(result.current.state.session).not.toBeNull());

    let openedWidgetId: string | null = null;
    await act(async () => {
      openedWidgetId = await result.current.addWidget(
        WIDGET_TYPE.STORAGE_STATUS,
        DESKTOP,
      );
    });

    expect(createWidget).not.toHaveBeenCalled();
    expect(openedWidgetId).toBe(storage.id);
    expect(result.current.activeWidgetId).toBe(storage.id);
    expect(result.current.state.widgets).toHaveLength(2);
  });

  it("reports the open-widget limit without calling the create API", async () => {
    const api = new FakeDashboardGateway();
    api.savedWidgets = Array.from({ length: MAX_OPEN_WIDGET_COUNT }, (_, index) => ({
      ...memoWidget(`memo-${index}`),
      stackOrder: index,
    }));
    const createWidget = vi.spyOn(api, "createWidget");
    const { result } = renderHook(() => useDashboard(api));
    await waitFor(() =>
      expect(result.current.state.widgets).toHaveLength(MAX_OPEN_WIDGET_COUNT),
    );

    let openedWidgetId: string | null = "not-null";
    await act(async () => {
      openedWidgetId = await result.current.addWidget(
        WIDGET_TYPE.MEMO,
        DESKTOP,
      );
    });

    expect(createWidget).not.toHaveBeenCalled();
    expect(openedWidgetId).toBeNull();
    expect(result.current.state.message?.text).toBe(UI_MESSAGES.MAX_WIDGETS);
  });

  it("returns the widget id after creating and reopening a widget", async () => {
    const api = new FakeDashboardGateway();
    const { result } = renderHook(() => useDashboard(api));
    await waitFor(() => expect(result.current.state.session).not.toBeNull());

    let createdWidgetId: string | null = null;
    await act(async () => {
      createdWidgetId = await result.current.addWidget(
        WIDGET_TYPE.MEMO,
        DESKTOP,
      );
    });
    expect(createdWidgetId).not.toBeNull();

    await act(async () => {
      await result.current.closeWidget(createdWidgetId!);
    });
    expect(result.current.state.widgets).toHaveLength(0);

    let reopenedWidgetId: string | null = null;
    await act(async () => {
      reopenedWidgetId = await result.current.openWidget(createdWidgetId!);
    });
    expect(reopenedWidgetId).toBe(createdWidgetId);
    expect(result.current.state.widgets).toHaveLength(1);
  });

  it("normalizes duplicate stack orders returned by consecutive program creation", async () => {
    const api = new FakeDashboardGateway();
    const storage = fakeWidgetFromLayout(
      layout(
        "00000000-0000-4000-8000-000000000001",
        WIDGET_TYPE.STORAGE_STATUS,
        0,
      ),
    );
    const admin = fakeWidgetFromLayout(
      layout(
        "00000000-0000-4000-8000-000000000002",
        WIDGET_TYPE.ADMIN,
        0,
      ),
    );
    vi.spyOn(api, "createWidget")
      .mockResolvedValueOnce(storage)
      .mockResolvedValueOnce(admin);
    const { result } = renderHook(() => useDashboard(api));
    await waitFor(() => expect(result.current.state.session).not.toBeNull());

    await act(async () => {
      await result.current.addWidget(WIDGET_TYPE.STORAGE_STATUS, DESKTOP);
      await result.current.addWidget(WIDGET_TYPE.ADMIN, DESKTOP);
    });

    expect(
      result.current.state.widgets.map(({ id, stackOrder }) => ({
        id,
        stackOrder,
      })),
    ).toEqual([
      { id: storage.id, stackOrder: 0 },
      { id: admin.id, stackOrder: 1 },
    ]);

    act(() => result.current.layoutSave.retry());
    await waitFor(() => expect(api.layoutSaveCalls).toHaveLength(1));
    const savedStackOrders = api.layoutSaveCalls[0]?.map(
      (widget) => widget.stackOrder,
    );
    expect(new Set(savedStackOrders).size).toBe(savedStackOrders?.length);
  });

  it("merges checklist reset metadata returned by layout auto-save", async () => {
    const api = new FakeDashboardGateway();
    const checklist = checklistWidget("checklist", 0);
    api.savedWidgets = [checklist];
    const replaceWidgets = api.replaceWidgets.bind(api);
    vi.spyOn(api, "replaceWidgets").mockImplementation(async (widgets) =>
      (await replaceWidgets(widgets)).map((widget) =>
        widget.type === WIDGET_TYPE.DAILY_CHECKLIST
          ? {
              ...widget,
              data: {
                ...widget.data,
                businessDate: "2026-08-21",
                nextResetAt: "2026-08-21T15:00:00.000Z",
              },
            }
          : widget,
      ),
    );
    const { result } = renderHook(() => useDashboard(api));
    await waitFor(() => expect(result.current.state.widgets).toHaveLength(1));

    act(() => result.current.toggleMaximizeWindow(checklist.id));
    act(() => result.current.layoutSave.retry());

    await waitFor(() => {
      const saved = result.current.state.widgets[0];
      expect(saved?.type).toBe(WIDGET_TYPE.DAILY_CHECKLIST);
      if (saved?.type === WIDGET_TYPE.DAILY_CHECKLIST) {
        expect(saved.data.businessDate).toBe("2026-08-21");
        expect(saved.data.nextResetAt).toBe("2026-08-21T15:00:00.000Z");
      }
    });
  });

  it("minimizes and restores the active taskbar widget", async () => {
    const api = new FakeDashboardGateway();
    const memo = memoWidget("memo");
    api.savedWidgets = [memo];
    const { result } = renderHook(() => useDashboard(api));
    await waitFor(() => expect(result.current.activeWidgetId).toBe(memo.id));

    act(() => result.current.activateTaskbarWindow(memo.id));
    expect(result.current.state.widgets[0]?.windowState).toBe(
      WINDOW_STATE.MINIMIZED,
    );

    act(() => result.current.activateTaskbarWindow(memo.id));
    expect(result.current.state.widgets[0]?.windowState).toBe(
      WINDOW_STATE.NORMAL,
    );
    expect(result.current.activeWidgetId).toBe(memo.id);
  });
});

function layout(
  id: string,
  type: WidgetLayout["type"],
  stackOrder: number,
): WidgetLayout {
  return {
    id,
    type,
    position: { x: 32, y: 32 },
    size: { width: 360, height: 240 },
    windowState: WINDOW_STATE.NORMAL,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
    stackOrder,
  };
}
