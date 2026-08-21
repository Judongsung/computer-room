import { describe, expect, it } from "vitest";
import { WidgetLayoutService } from "../src/application/widget-layout-service";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "../src/constants/widget";
import {
  MemoryChecklistRepository,
  MemoryMemoRepository,
  MemoryWidgetLayoutRepository,
  StaticClock,
} from "./fakes";

const MEMO_WINDOW_POLICY = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];
const NOW = Date.parse("2026-08-20T01:00:00.000Z");

describe("WidgetLayoutService", () => {
  it("validates, sorts, and replaces the complete layout", async () => {
    const repository = new MemoryWidgetLayoutRepository();
    const service = new WidgetLayoutService(
      repository,
      new MemoryMemoRepository(),
      new MemoryChecklistRepository(),
      new StaticClock(NOW),
    );
    const right = {
      id: "00000000-0000-4000-8000-000000000002",
      type: WIDGET_TYPE.MEMO,
      position: { x: 72, y: 32 },
      size: {
        width: MEMO_WINDOW_POLICY.DEFAULT_WIDTH,
        height: MEMO_WINDOW_POLICY.DEFAULT_HEIGHT,
      },
      windowState: WINDOW_STATE.NORMAL,
      restoreState: WINDOW_RESTORE_STATE.NORMAL,
      stackOrder: 1,
    } as const;
    const left = {
      id: "00000000-0000-4000-8000-000000000001",
      type: WIDGET_TYPE.MEMO,
      position: { x: 32, y: 32 },
      size: {
        width: MEMO_WINDOW_POLICY.DEFAULT_WIDTH,
        height: MEMO_WINDOW_POLICY.DEFAULT_HEIGHT,
      },
      windowState: WINDOW_STATE.NORMAL,
      restoreState: WINDOW_RESTORE_STATE.NORMAL,
      stackOrder: 0,
    } as const;

    const expected = [left, right].map((widget) => ({
      ...widget,
      data: { markdown: "", updatedAt: null },
    }));

    await expect(service.replaceWidgets([right, left])).resolves.toEqual(expected);
    await expect(service.listWidgets()).resolves.toEqual(expected);
  });
});
