import { describe, expect, it } from "vitest";
import { WidgetLayoutService } from "../src/application/widget-layout-service";
import { WIDGET_SIZE_BY_TYPE, WIDGET_TYPE } from "../src/constants/widget";
import {
  MemoryChecklistRepository,
  MemoryMemoRepository,
  MemoryWidgetLayoutRepository,
  StaticClock,
} from "./fakes";

const MEMO_WIDGET_SIZE = WIDGET_SIZE_BY_TYPE[WIDGET_TYPE.MEMO];
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
      position: { column: MEMO_WIDGET_SIZE.DEFAULT_COLUMNS, row: 0 },
      size: {
        columns: MEMO_WIDGET_SIZE.DEFAULT_COLUMNS,
        rows: MEMO_WIDGET_SIZE.DEFAULT_ROWS,
      },
    } as const;
    const left = {
      id: "00000000-0000-4000-8000-000000000001",
      type: WIDGET_TYPE.MEMO,
      position: { column: 0, row: 0 },
      size: {
        columns: MEMO_WIDGET_SIZE.DEFAULT_COLUMNS,
        rows: MEMO_WIDGET_SIZE.DEFAULT_ROWS,
      },
    } as const;

    const expected = [left, right].map((widget) => ({
      ...widget,
      data: { markdown: "", updatedAt: null },
    }));

    await expect(service.replaceWidgets([right, left])).resolves.toEqual(expected);
    await expect(service.listWidgets()).resolves.toEqual(expected);
  });
});
