import { describe, expect, it } from "vitest";
import { WIDGET_ERRORS } from "../src/constants/errors/widget";
import {
  findFirstAvailablePosition,
  widgetLayoutsEqual,
  widgetsOverlap,
} from "../src/domain/widget-layout";
import { validateWidgetLayout } from "../src/domain/widget-layout-validation";
import {
  GRID_COLUMN_COUNT,
  WIDGET_SIZE_BY_TYPE,
  WIDGET_TYPE,
} from "../src/constants/widget";
import type { WidgetLayout } from "../src/types/widget";

describe("widget layout rules", () => {
  it("finds the first free grid position from left to right", () => {
    const first = defaultWidget("00000000-0000-4000-8000-000000000001", 0, 0);

    expect(findFirstAvailablePosition([], DEFAULT_WIDGET_SIZE)).toEqual({
      column: 0,
      row: 0,
    });
    expect(findFirstAvailablePosition([first], DEFAULT_WIDGET_SIZE)).toEqual({
      column: MEMO_WIDGET_SIZE.DEFAULT_COLUMNS,
      row: 0,
    });
  });

  it("treats touching edges as non-overlapping", () => {
    const left = defaultWidget("00000000-0000-4000-8000-000000000001", 0, 0);
    const right = defaultWidget(
      "00000000-0000-4000-8000-000000000002",
      MEMO_WIDGET_SIZE.DEFAULT_COLUMNS,
      0,
    );

    expect(widgetsOverlap(left, right)).toBe(false);
    expect(widgetLayoutsEqual([left, right], [right, left])).toBe(true);
  });

  it("rejects collisions, duplicate ids, and out-of-bounds sizes", () => {
    const first = defaultWidget("00000000-0000-4000-8000-000000000001", 0, 0);

    expect(() =>
      validateWidgetLayout([
        first,
        defaultWidget("00000000-0000-4000-8000-000000000002", 3, 1),
      ]),
    ).toThrowError(
      expect.objectContaining({ code: WIDGET_ERRORS.WIDGET_COLLISION.code }),
    );
    expect(() => validateWidgetLayout([first, first])).toThrowError(
      expect.objectContaining({ code: WIDGET_ERRORS.DUPLICATE_WIDGET_ID.code }),
    );
    expect(() =>
      validateWidgetLayout([
        defaultWidget(
          "00000000-0000-4000-8000-000000000003",
          GRID_COLUMN_COUNT - MEMO_WIDGET_SIZE.DEFAULT_COLUMNS + 1,
          0,
        ),
      ]),
    ).toThrowError(
      expect.objectContaining({ code: WIDGET_ERRORS.INVALID_LAYOUT.code }),
    );
  });
});

const MEMO_WIDGET_SIZE = WIDGET_SIZE_BY_TYPE[WIDGET_TYPE.MEMO];

const DEFAULT_WIDGET_SIZE = {
  columns: MEMO_WIDGET_SIZE.DEFAULT_COLUMNS,
  rows: MEMO_WIDGET_SIZE.DEFAULT_ROWS,
} as const;

function defaultWidget(id: string, column: number, row: number): WidgetLayout {
  return widget(
    id,
    column,
    row,
    DEFAULT_WIDGET_SIZE.columns,
    DEFAULT_WIDGET_SIZE.rows,
  );
}

function widget(
  id: string,
  column: number,
  row: number,
  columns: number,
  rows: number,
): WidgetLayout {
  return {
    id,
    type: WIDGET_TYPE.MEMO,
    position: { column, row },
    size: { columns, rows },
  };
}
