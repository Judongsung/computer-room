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
  MemoryFileRepository,
  MemoryMemoRepository,
  MemoryWidgetLayoutRepository,
  StaticClock,
  SequenceIdGenerator,
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
      new MemoryFileRepository(),
      new SequenceIdGenerator([
        "00000000-0000-4000-8000-000000000010",
      ]),
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

    await repository.insert(right);
    await repository.insert(left);
    const expected = [left, right].map((widget) => ({
      ...widget,
      file: null,
      data: { markdown: "", updatedAt: null },
    }));

    await expect(service.replaceWidgets([right, left])).resolves.toEqual(expected);
    await expect(service.listWidgets()).resolves.toEqual(expected);
  });
});
