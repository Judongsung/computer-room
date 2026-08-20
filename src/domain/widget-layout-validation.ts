import { WIDGET_ERRORS } from "../constants/errors/widget";
import {
  GRID_COLUMN_COUNT,
  GRID_MAX_START_ROW,
  MAX_WIDGET_COUNT,
  WIDGET_SIZE_BY_TYPE,
} from "../constants/widget";
import type { WidgetLayout } from "../types/widget";
import { AppError } from "./errors";
import {
  cloneWidgetLayouts,
  sortWidgetLayouts,
  widgetsOverlap,
} from "./widget-layout";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateWidgetLayout(
  widgets: readonly WidgetLayout[],
): WidgetLayout[] {
  if (widgets.length > MAX_WIDGET_COUNT) {
    throw new AppError(WIDGET_ERRORS.TOO_MANY_WIDGETS);
  }

  const ids = new Set<string>();
  for (const widget of widgets) {
    if (!UUID_V4.test(widget.id) || !hasValidGridValues(widget)) {
      throw new AppError(WIDGET_ERRORS.INVALID_LAYOUT);
    }

    if (ids.has(widget.id)) {
      throw new AppError(WIDGET_ERRORS.DUPLICATE_WIDGET_ID);
    }
    ids.add(widget.id);
  }

  for (let leftIndex = 0; leftIndex < widgets.length; leftIndex += 1) {
    const left = widgets[leftIndex];
    if (!left) {
      continue;
    }

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < widgets.length;
      rightIndex += 1
    ) {
      const right = widgets[rightIndex];
      if (right && widgetsOverlap(left, right)) {
        throw new AppError(WIDGET_ERRORS.WIDGET_COLLISION);
      }
    }
  }

  return sortWidgetLayouts(cloneWidgetLayouts(widgets));
}

function hasValidGridValues(widget: WidgetLayout): boolean {
  const values = [
    widget.position.column,
    widget.position.row,
    widget.size.columns,
    widget.size.rows,
  ];
  if (!values.every(Number.isSafeInteger)) {
    return false;
  }

  const sizePolicy = WIDGET_SIZE_BY_TYPE[widget.type];
  return (
    widget.position.column >= 0 &&
    widget.position.column < GRID_COLUMN_COUNT &&
    widget.position.row >= 0 &&
    widget.position.row <= GRID_MAX_START_ROW &&
    widget.size.columns >= sizePolicy.MIN_COLUMNS &&
    widget.size.columns <= sizePolicy.MAX_COLUMNS &&
    widget.size.rows >= sizePolicy.MIN_ROWS &&
    widget.size.rows <= sizePolicy.MAX_ROWS &&
    widget.position.column + widget.size.columns <= GRID_COLUMN_COUNT
  );
}
