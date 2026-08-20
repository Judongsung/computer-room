import { describe, expect, it } from "vitest";
import {
  BLANK_WIDGET_SIZE,
  WIDGET_TYPE,
} from "../../src/constants/widget";
import {
  fromGridLayout,
  toGridLayout,
} from "../../src/client/components/dashboard/desktop-widget-grid";
import type { WidgetLayout } from "../../src/types/widget";

const WIDGET: WidgetLayout = {
  id: "00000000-0000-4000-8000-000000000001",
  type: WIDGET_TYPE.BLANK,
  position: { column: 2, row: 3 },
  size: {
    columns: BLANK_WIDGET_SIZE.DEFAULT_COLUMNS,
    rows: BLANK_WIDGET_SIZE.DEFAULT_ROWS,
  },
};

describe("React Grid Layout adapter", () => {
  it("maps domain widgets to editable grid items", () => {
    expect(toGridLayout([WIDGET], true)).toEqual([
      expect.objectContaining({
        i: WIDGET.id,
        x: 2,
        y: 3,
        w: BLANK_WIDGET_SIZE.DEFAULT_COLUMNS,
        h: BLANK_WIDGET_SIZE.DEFAULT_ROWS,
        isDraggable: true,
        isResizable: true,
      }),
    ]);
  });

  it("maps grid changes back without leaking library fields", () => {
    expect(
      fromGridLayout(
        [{ i: WIDGET.id, x: 5, y: 7, w: 6, h: 4, moved: true }],
        [WIDGET],
      ),
    ).toEqual([
      {
        ...WIDGET,
        position: { column: 5, row: 7 },
        size: { columns: 6, rows: 4 },
      },
    ]);
  });
});
