import { UI_MESSAGES } from "@client/content/ko/widgets/dashboard";
import {
  useCallback,
  useMemo,
} from "react";
import {
  WIDGET_TYPE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import type { DashboardWidget } from "@/types/widgets/widget";
import { MESSAGE_KIND } from "@client/constants/widgets/dashboard";
import {
  activeWidgetId,
  bringWidgetToFront,
  minimizeWindow as minimizeWindowState,
  replaceWidgetBounds,
  restoreWindow as restoreWindowState,
  toggleMaximizeWindow as toggleMaximizeWindowState,
} from "@client/domain/desktop/window-layout";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { WindowBounds } from "@client/types/desktop/desktop";
import { useUnsavedChangesWarning } from "@client/hooks/shared/use-unsaved-changes-warning";
import { useWidgetLayoutAutoSave } from "@client/hooks/widgets/use-widget-layout-auto-save";
import { useDashboardState } from "@client/hooks/widgets/use-dashboard-state";
import { useDashboardWidgetCollection } from "@client/hooks/widgets/use-dashboard-widget-collection";
import { useWidgetLifecycleCommands } from "@client/hooks/widgets/use-widget-lifecycle-commands";

export function useDashboard(api: DashboardGateway) {
  const {
    state,
    widgetsRef,
    replaceWidgets,
    setMessage,
    showError,
    dismissMessage,
    retryLoad,
  } = useDashboardState(api);
  const mergeSavedWidgetMetadata = useCallback(
    (savedWidgets: readonly DashboardWidget[]): void => {
      const savedById = new Map(
        savedWidgets.map((widget) => [widget.id, widget] as const),
      );
      const widgets = widgetsRef.current.map((widget) => {
        const saved = savedById.get(widget.id);
        if (
          widget.type !== WIDGET_TYPE.DAILY_CHECKLIST ||
          saved?.type !== WIDGET_TYPE.DAILY_CHECKLIST
        ) {
          return widget;
        }
        return {
          ...widget,
          data: {
            ...widget.data,
            businessDate: saved.data.businessDate,
            nextResetAt: saved.data.nextResetAt,
          },
        };
      });
      replaceWidgets(widgets);
    },
    [replaceWidgets, widgetsRef],
  );
  const layoutSaveOptions = useMemo(
    () => ({
      fallbackErrorMessage: UI_MESSAGES.SAVE_FAILED,
      onSaved: mergeSavedWidgetMetadata,
    }),
    [mergeSavedWidgetMetadata],
  );
  const layoutSave = useWidgetLayoutAutoSave(api, layoutSaveOptions);
  const scheduleLayoutSave = layoutSave.schedule;

  useUnsavedChangesWarning(layoutSave.hasUnsavedChanges);

  const collection = useDashboardWidgetCollection({
    widgetsRef,
    replaceWidgets,
    scheduleLayoutSave,
    forgetLayouts: layoutSave.forget,
  });
  const replaceAndSave = collection.replaceAndSave;
  const lifecycle = useWidgetLifecycleCommands({
    gateway: api,
    collection,
    reportError: showError,
    reportMessage: (message) =>
      setMessage({ kind: MESSAGE_KIND.ERROR, text: message }),
  });

  const focusWindow = useCallback(
    (widgetId: string): void => {
      if (activeWidgetId(widgetsRef.current) === widgetId) {
        return;
      }
      replaceAndSave((widgets) => bringWidgetToFront(widgets, widgetId));
    },
    [replaceAndSave],
  );

  const minimizeWindow = useCallback(
    (widgetId: string): void => {
      replaceAndSave((widgets) =>
        widgets.map((widget) =>
          widget.id === widgetId ? minimizeWindowState(widget) : widget,
        ),
      );
    },
    [replaceAndSave],
  );

  const toggleMaximizeWindow = useCallback(
    (widgetId: string): void => {
      replaceAndSave((widgets) => {
        const focused = bringWidgetToFront(widgets, widgetId);
        return focused.map((widget) =>
          widget.id === widgetId ? toggleMaximizeWindowState(widget) : widget,
        );
      });
    },
    [replaceAndSave],
  );

  const activateTaskbarWindow = useCallback(
    (widgetId: string): void => {
      const widget = widgetsRef.current.find(
        (candidate) => candidate.id === widgetId,
      );
      if (!widget) {
        return;
      }

      if (widget.windowState === WINDOW_STATE.MINIMIZED) {
        replaceAndSave((widgets) =>
          bringWidgetToFront(
            widgets.map((candidate) =>
              candidate.id === widgetId
                ? restoreWindowState(candidate)
                : candidate,
            ),
            widgetId,
          ),
        );
      } else if (activeWidgetId(widgetsRef.current) === widgetId) {
        minimizeWindow(widgetId);
      } else {
        focusWindow(widgetId);
      }
    },
    [focusWindow, minimizeWindow, replaceAndSave],
  );

  const commitWindowBounds = useCallback(
    (widgetId: string, bounds: WindowBounds): void => {
      replaceAndSave((widgets) =>
        bringWidgetToFront(
          widgets.map((widget) =>
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

  const retry = retryLoad;

  const currentActiveWidgetId = useMemo(
    () => activeWidgetId(state.widgets),
    [state.widgets],
  );

  return {
    state,
    activeWidgetId: currentActiveWidgetId,
    layoutSave,
    ...lifecycle,
    focusWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    activateTaskbarWindow,
    commitWindowBounds,
    gateway: api,
    retry,
    dismissMessage,
  };
}
