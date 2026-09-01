import {
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import { sortWidgetLayouts } from "@/domain/widgets/widget-layout";
import type {
  DashboardWidget,
  WidgetLayout,
  WindowPosition,
  WindowSize,
} from "@/types/widgets/widget";
import { DESKTOP_LAYOUT } from "@client/constants/desktop/desktop";
import type {
  DesktopDimensions,
  WindowBounds,
  WindowLifecycleState,
} from "@client/types/desktop/desktop";

export function activeWidgetId(
  widgets: readonly WidgetLayout[],
): string | null {
  const visible = widgets.filter(
    (widget) => widget.windowState !== WINDOW_STATE.MINIMIZED,
  );
  return visible.length === 0
    ? null
    : sortWidgetLayouts(visible).at(-1)?.id ?? null;
}

export function bringWidgetToFront<T extends WidgetLayout>(
  widgets: readonly T[],
  widgetId: string,
): T[] {
  const ordered = sortWidgetLayouts(widgets);
  const target = ordered.find((widget) => widget.id === widgetId);
  if (!target) {
    return [...widgets];
  }

  const nextStackOrderById = new Map(
    [
      ...ordered.filter((widget) => widget.id !== widgetId),
      target,
    ].map((widget, stackOrder) => [widget.id, stackOrder] as const),
  );

  return widgets.map((widget) => ({
    ...widget,
    stackOrder: nextStackOrderById.get(widget.id) ?? widget.stackOrder,
  }));
}

export function minimizeWindow<T extends WindowLifecycleState>(window: T): T {
  if (window.windowState === WINDOW_STATE.MINIMIZED) {
    return window;
  }
  return {
    ...window,
    restoreState:
      window.windowState === WINDOW_STATE.MAXIMIZED
        ? WINDOW_RESTORE_STATE.MAXIMIZED
        : WINDOW_RESTORE_STATE.NORMAL,
    windowState: WINDOW_STATE.MINIMIZED,
  };
}

export function restoreWindow<T extends WindowLifecycleState>(window: T): T {
  if (window.windowState !== WINDOW_STATE.MINIMIZED) {
    return window;
  }
  return { ...window, windowState: window.restoreState };
}

export function toggleMaximizeWindow<T extends WindowLifecycleState>(
  window: T,
): T {
  if (window.windowState === WINDOW_STATE.MAXIMIZED) {
    return {
      ...window,
      windowState: WINDOW_STATE.NORMAL,
      restoreState: WINDOW_RESTORE_STATE.NORMAL,
    };
  }
  return {
    ...window,
    windowState: WINDOW_STATE.MAXIMIZED,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
  };
}

export function replaceWidgetBounds<T extends DashboardWidget>(
  widget: T,
  bounds: WindowBounds,
): T {
  return {
    ...widget,
    position: { ...bounds.position },
    size: { ...bounds.size },
    windowState: WINDOW_STATE.NORMAL,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
  };
}

export function clampWindowBounds(
  position: WindowPosition,
  size: WindowSize,
  desktop: DesktopDimensions,
): WindowBounds {
  const width = Math.min(size.width, desktop.width);
  const height = Math.min(size.height, desktop.height);
  return {
    position: {
      x: clamp(position.x, 0, Math.max(0, desktop.width - width)),
      y: clamp(position.y, 0, Math.max(0, desktop.height - height)),
    },
    size: { width, height },
  };
}

export function cascadeWindowPosition(
  index: number,
  size: WindowSize,
  desktop: DesktopDimensions,
): WindowPosition {
  const startX = Math.min(
    DESKTOP_LAYOUT.INITIAL_WINDOW_OFFSET_PX,
    Math.max(0, desktop.width - size.width),
  );
  const startY = Math.min(
    DESKTOP_LAYOUT.INITIAL_WINDOW_OFFSET_PX,
    Math.max(0, desktop.height - size.height),
  );
  const maxX = Math.max(startX, desktop.width - size.width);
  const maxY = Math.max(startY, desktop.height - size.height);
  const cascadeSlots = Math.min(
    slotCount(startX, maxX),
    slotCount(startY, maxY),
  );
  const slot = index % cascadeSlots;

  return {
    x: Math.min(
      startX + slot * DESKTOP_LAYOUT.WINDOW_CASCADE_STEP_PX,
      maxX,
    ),
    y: Math.min(
      startY + slot * DESKTOP_LAYOUT.WINDOW_CASCADE_STEP_PX,
      maxY,
    ),
  };
}

function slotCount(start: number, maximum: number): number {
  return (
    Math.floor(
      (maximum - start) / DESKTOP_LAYOUT.WINDOW_CASCADE_STEP_PX,
    ) + 1
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(Math.round(value), minimum), maximum);
}
