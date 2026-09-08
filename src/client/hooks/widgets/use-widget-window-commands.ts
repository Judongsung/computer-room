import { useCallback, useMemo } from "react";
import { WINDOW_STATE } from "@/constants/widgets/widget";
import type { DashboardWidget } from "@/types/widgets/widget";
import {
  activeWidgetId,
  bringWidgetToFront,
  minimizeWindow as minimizeWindowState,
  replaceWidgetBounds,
  restoreWindow as restoreWindowState,
  toggleMaximizeWindow as toggleMaximizeWindowState,
} from "@client/domain/desktop/window-layout";
import type { WindowBounds } from "@client/types/desktop/window";
import type {
  DashboardWidgetCollectionController,
  WidgetWindowCommands,
} from "@client/types/widgets/dashboard";

export function useWidgetWindowCommands(
  collection: DashboardWidgetCollectionController,
  widgets: readonly DashboardWidget[],
): WidgetWindowCommands {
  const { current, replaceAndSave } = collection;

  const focusWindow = useCallback(
    (widgetId: string): void => {
      if (activeWidgetId(current()) === widgetId) return;
      replaceAndSave((items) => bringWidgetToFront(items, widgetId));
    },
    [current, replaceAndSave],
  );

  const minimizeWindow = useCallback(
    (widgetId: string): void => {
      replaceAndSave((items) =>
        items.map((widget) =>
          widget.id === widgetId ? minimizeWindowState(widget) : widget,
        ),
      );
    },
    [replaceAndSave],
  );

  const toggleMaximizeWindow = useCallback(
    (widgetId: string): void => {
      replaceAndSave((items) => {
        const focused = bringWidgetToFront(items, widgetId);
        return focused.map((widget) =>
          widget.id === widgetId
            ? toggleMaximizeWindowState(widget)
            : widget,
        );
      });
    },
    [replaceAndSave],
  );

  const activateTaskbarWindow = useCallback(
    (widgetId: string): void => {
      const widget = current().find((candidate) => candidate.id === widgetId);
      if (!widget) return;
      if (widget.windowState === WINDOW_STATE.MINIMIZED) {
        replaceAndSave((items) =>
          bringWidgetToFront(
            items.map((candidate) =>
              candidate.id === widgetId
                ? restoreWindowState(candidate)
                : candidate,
            ),
            widgetId,
          ),
        );
      } else if (activeWidgetId(current()) === widgetId) {
        minimizeWindow(widgetId);
      } else {
        focusWindow(widgetId);
      }
    },
    [current, focusWindow, minimizeWindow, replaceAndSave],
  );

  const commitWindowBounds = useCallback(
    (widgetId: string, bounds: WindowBounds): void => {
      replaceAndSave((items) =>
        bringWidgetToFront(
          items.map((widget) =>
            widget.id === widgetId
              ? replaceWidgetBounds(widget, bounds)
              : widget,
          ),
          widgetId,
        ),
      );
    },
    [replaceAndSave],
  );

  const currentActiveWidgetId = useMemo(
    () => activeWidgetId(widgets),
    [widgets],
  );

  return {
    activeWidgetId: currentActiveWidgetId,
    focusWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    activateTaskbarWindow,
    commitWindowBounds,
  };
}
