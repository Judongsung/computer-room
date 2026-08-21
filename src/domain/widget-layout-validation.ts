import { WIDGET_ERRORS } from "../constants/errors/widget";
import {
  MAX_WIDGET_COUNT,
  WIDGET_WINDOW_POLICY,
  WINDOW_POSITION_LIMITS,
} from "../constants/widget";
import type { WidgetLayout } from "../types/widget";
import { AppError } from "./errors";
import {
  cloneWidgetLayouts,
  sortWidgetLayouts,
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
  const stackOrders = new Set<number>();
  for (const widget of widgets) {
    if (!UUID_V4.test(widget.id) || !hasValidWindowValues(widget)) {
      throw new AppError(WIDGET_ERRORS.INVALID_LAYOUT);
    }

    if (ids.has(widget.id)) {
      throw new AppError(WIDGET_ERRORS.DUPLICATE_WIDGET_ID);
    }
    ids.add(widget.id);
    if (stackOrders.has(widget.stackOrder)) {
      throw new AppError(WIDGET_ERRORS.DUPLICATE_STACK_ORDER);
    }
    stackOrders.add(widget.stackOrder);
  }

  return sortWidgetLayouts(cloneWidgetLayouts(widgets));
}

function hasValidWindowValues(widget: WidgetLayout): boolean {
  const values = [
    widget.position.x,
    widget.position.y,
    widget.size.width,
    widget.size.height,
    widget.stackOrder,
  ];
  if (!values.every(Number.isSafeInteger)) {
    return false;
  }

  const sizePolicy = WIDGET_WINDOW_POLICY[widget.type];
  return (
    widget.position.x >= WINDOW_POSITION_LIMITS.MIN_X &&
    widget.position.x <= WINDOW_POSITION_LIMITS.MAX_X &&
    widget.position.y >= WINDOW_POSITION_LIMITS.MIN_Y &&
    widget.position.y <= WINDOW_POSITION_LIMITS.MAX_Y &&
    widget.size.width >= sizePolicy.MIN_WIDTH &&
    widget.size.width <= sizePolicy.MAX_WIDTH &&
    widget.size.height >= sizePolicy.MIN_HEIGHT &&
    widget.size.height <= sizePolicy.MAX_HEIGHT &&
    widget.stackOrder >= 0
  );
}
