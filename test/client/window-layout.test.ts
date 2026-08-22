import { describe, expect, it } from "vitest";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "../../src/constants/widget";
import {
  activeWidgetId,
  bringWidgetToFront,
  cascadeWindowPosition,
  clampWindowBounds,
  minimizeWindow,
  restoreWindow,
  toggleMaximizeWindow,
} from "../../src/client/domain/window-layout";
import type { WidgetLayout } from "../../src/types/widget";

describe("desktop window layout", () => {
  it("cascades new windows and clamps stored bounds to the desktop", () => {
    const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];
    const size = {
      width: policy.DEFAULT_WIDTH,
      height: policy.DEFAULT_HEIGHT,
    };

    expect(cascadeWindowPosition(0, size, DESKTOP)).toEqual({ x: 32, y: 32 });
    expect(cascadeWindowPosition(1, size, DESKTOP)).toEqual({ x: 64, y: 64 });
    expect(clampWindowBounds({ x: 900, y: 700 }, size, DESKTOP)).toEqual({
      position: { x: 544, y: 448 },
      size,
    });
  });

  it("focuses, minimizes, restores, maximizes, and restores maximized windows", () => {
    const back = widget("00000000-0000-4000-8000-000000000001", 0);
    const front = widget("00000000-0000-4000-8000-000000000002", 1);
    const focused = bringWidgetToFront([back, front], back.id);

    expect(focused.map((widget) => widget.id)).toEqual([back.id, front.id]);
    expect(activeWidgetId(focused)).toBe(back.id);
    const focusedBack = focused.find((widget) => widget.id === back.id);
    expect(focusedBack).toBeDefined();
    const maximized = toggleMaximizeWindow(focusedBack!);
    expect(maximized.windowState).toBe(WINDOW_STATE.MAXIMIZED);
    const minimized = minimizeWindow(maximized);
    expect(minimized).toMatchObject({
      windowState: WINDOW_STATE.MINIMIZED,
      restoreState: WINDOW_RESTORE_STATE.MAXIMIZED,
    });
    expect(restoreWindow(minimized).windowState).toBe(WINDOW_STATE.MAXIMIZED);
    expect(toggleMaximizeWindow(maximized).windowState).toBe(
      WINDOW_STATE.NORMAL,
    );
  });
});

const DESKTOP = { width: 1_024, height: 768 } as const;
const MEMO_WINDOW_POLICY = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];

function widget(id: string, stackOrder: number): WidgetLayout {
  return {
    id,
    type: WIDGET_TYPE.MEMO,
    position: { x: 32, y: 32 },
    size: {
      width: MEMO_WINDOW_POLICY.DEFAULT_WIDTH,
      height: MEMO_WINDOW_POLICY.DEFAULT_HEIGHT,
    },
    windowState: WINDOW_STATE.NORMAL,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
    stackOrder,
  };
}
