import { describe, expect, it } from "vitest";
import { WidgetLayoutService } from "../src/application/widget-layout-service";
import { BLANK_WIDGET_SIZE, WIDGET_TYPE } from "../src/constants/widget";
import { MemoryWidgetLayoutRepository } from "./fakes";

describe("WidgetLayoutService", () => {
  it("validates, sorts, and replaces the complete layout", async () => {
    const repository = new MemoryWidgetLayoutRepository();
    const service = new WidgetLayoutService(repository);
    const right = {
      id: "00000000-0000-4000-8000-000000000002",
      type: WIDGET_TYPE.BLANK,
      position: { column: BLANK_WIDGET_SIZE.DEFAULT_COLUMNS, row: 0 },
      size: {
        columns: BLANK_WIDGET_SIZE.DEFAULT_COLUMNS,
        rows: BLANK_WIDGET_SIZE.DEFAULT_ROWS,
      },
    } as const;
    const left = {
      id: "00000000-0000-4000-8000-000000000001",
      type: WIDGET_TYPE.BLANK,
      position: { column: 0, row: 0 },
      size: {
        columns: BLANK_WIDGET_SIZE.DEFAULT_COLUMNS,
        rows: BLANK_WIDGET_SIZE.DEFAULT_ROWS,
      },
    } as const;

    await expect(service.replaceWidgets([right, left])).resolves.toEqual([
      left,
      right,
    ]);
    await expect(service.listWidgets()).resolves.toEqual([left, right]);
  });
});
