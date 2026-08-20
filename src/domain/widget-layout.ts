import {
  GRID_COLUMN_COUNT,
  GRID_MAX_START_ROW,
  WIDGET_TYPE,
} from "../constants/widget";
import type {
  GridPosition,
  GridSize,
  WidgetLayout,
  WidgetLayoutCollection,
} from "../types/widget";

export function isWidgetLayoutCollection(
  value: unknown,
): value is WidgetLayoutCollection {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return false;
  }

  return value.items.every(isWidgetLayout);
}

export function sortWidgetLayouts(
  widgets: readonly WidgetLayout[],
): WidgetLayout[] {
  return [...widgets].sort(
    (left, right) =>
      left.position.row - right.position.row ||
      left.position.column - right.position.column ||
      left.id.localeCompare(right.id),
  );
}

export function cloneWidgetLayouts(
  widgets: readonly WidgetLayout[],
): WidgetLayout[] {
  return widgets.map((widget) => ({
    id: widget.id,
    type: widget.type,
    position: { ...widget.position },
    size: { ...widget.size },
  }));
}

export function widgetLayoutsEqual(
  left: readonly WidgetLayout[],
  right: readonly WidgetLayout[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = sortWidgetLayouts(left);
  const sortedRight = sortWidgetLayouts(right);
  return sortedLeft.every((widget, index) => {
    const candidate = sortedRight[index];
    return (
      candidate !== undefined &&
      widget.id === candidate.id &&
      widget.type === candidate.type &&
      widget.position.column === candidate.position.column &&
      widget.position.row === candidate.position.row &&
      widget.size.columns === candidate.size.columns &&
      widget.size.rows === candidate.size.rows
    );
  });
}

export function widgetsOverlap(
  left: WidgetLayout,
  right: WidgetLayout,
): boolean {
  return (
    left.position.column < right.position.column + right.size.columns &&
    left.position.column + left.size.columns > right.position.column &&
    left.position.row < right.position.row + right.size.rows &&
    left.position.row + left.size.rows > right.position.row
  );
}

export function findFirstAvailablePosition(
  widgets: readonly WidgetLayout[],
  size: GridSize,
): GridPosition | null {
  for (let row = 0; row <= GRID_MAX_START_ROW; row += 1) {
    for (
      let column = 0;
      column <= GRID_COLUMN_COUNT - size.columns;
      column += 1
    ) {
      const candidate: WidgetLayout = {
        id: "candidate",
        type: WIDGET_TYPE.BLANK,
        position: { column, row },
        size,
      };

      if (!widgets.some((widget) => widgetsOverlap(candidate, widget))) {
        return candidate.position;
      }
    }
  }

  return null;
}

function isWidgetLayout(value: unknown): value is WidgetLayout {
  if (!isRecord(value) || !isRecord(value.position) || !isRecord(value.size)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.type === WIDGET_TYPE.BLANK &&
    typeof value.position.column === "number" &&
    typeof value.position.row === "number" &&
    typeof value.size.columns === "number" &&
    typeof value.size.rows === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
