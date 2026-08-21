import {
  WIDGET_TYPE,
  WIDGET_TYPE_VALUES,
  WINDOW_RESTORE_STATE_VALUES,
  WINDOW_STATE_VALUES,
} from "../constants/widget";
import type {
  DashboardWidget,
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

export function sortWidgetLayouts<T extends WidgetLayout>(
  widgets: readonly T[],
): T[] {
  return [...widgets].sort(
    (left, right) =>
      left.stackOrder - right.stackOrder ||
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
    windowState: widget.windowState,
    restoreState: widget.restoreState,
    stackOrder: widget.stackOrder,
  }));
}

export function toWidgetLayout(widget: WidgetLayout): WidgetLayout {
  return {
    id: widget.id,
    type: widget.type,
    position: { ...widget.position },
    size: { ...widget.size },
    windowState: widget.windowState,
    restoreState: widget.restoreState,
    stackOrder: widget.stackOrder,
  };
}

export function cloneDashboardWidgets(
  widgets: readonly DashboardWidget[],
): DashboardWidget[] {
  return widgets.map((widget) => {
    const layout = toWidgetLayout(widget);
    if (widget.type === WIDGET_TYPE.MEMO) {
      return {
        ...layout,
        type: WIDGET_TYPE.MEMO,
        data: { ...widget.data },
      };
    }
    return {
      ...layout,
      type: WIDGET_TYPE.DAILY_CHECKLIST,
      data: {
        ...widget.data,
        items: widget.data.items.map((item) => ({ ...item })),
      },
    };
  });
}

export function replaceDashboardWidgetData(
  widgets: readonly DashboardWidget[],
  replacement: DashboardWidget,
): DashboardWidget[] {
  return widgets.map((widget) => {
    if (widget.id !== replacement.id || widget.type !== replacement.type) {
      return widget;
    }
    if (
      widget.type === WIDGET_TYPE.MEMO &&
      replacement.type === WIDGET_TYPE.MEMO
    ) {
      return { ...widget, data: { ...replacement.data } };
    }
    if (
      widget.type === WIDGET_TYPE.DAILY_CHECKLIST &&
      replacement.type === WIDGET_TYPE.DAILY_CHECKLIST
    ) {
      return {
        ...widget,
        data: {
          ...replacement.data,
          items: replacement.data.items.map((item) => ({ ...item })),
        },
      };
    }
    return widget;
  });
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
      widget.position.x === candidate.position.x &&
      widget.position.y === candidate.position.y &&
      widget.size.width === candidate.size.width &&
      widget.size.height === candidate.size.height &&
      widget.windowState === candidate.windowState &&
      widget.restoreState === candidate.restoreState &&
      widget.stackOrder === candidate.stackOrder
    );
  });
}

function isWidgetLayout(value: unknown): value is WidgetLayout {
  if (!isRecord(value) || !isRecord(value.position) || !isRecord(value.size)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    WIDGET_TYPE_VALUES.some((type) => value.type === type) &&
    typeof value.position.x === "number" &&
    typeof value.position.y === "number" &&
    typeof value.size.width === "number" &&
    typeof value.size.height === "number" &&
    WINDOW_STATE_VALUES.some((state) => value.windowState === state) &&
    WINDOW_RESTORE_STATE_VALUES.some(
      (state) => value.restoreState === state,
    ) &&
    typeof value.stackOrder === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
