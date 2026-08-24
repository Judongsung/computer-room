import {
  useCallback,
  useMemo,
} from "react";
import {
  MAX_OPEN_WIDGET_COUNT,
  WIDGET_BEHAVIOR,
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import {
  cloneDashboardWidgets,
  replaceDashboardWidgetData,
} from "@/domain/widgets/widget-layout";
import type {
  DashboardWidget,
  WidgetType,
} from "@/types/widgets/widget";
import type { SaveWidgetFileInput } from "@/types/filesystem/filesystem";
import {
  DASHBOARD_ACTION_TYPE,
  MESSAGE_KIND,
  UI_MESSAGES,
} from "@client/constants/widgets/dashboard";
import {
  activeWidgetId,
  bringWidgetToFront,
  cascadeWindowPosition,
  minimizeWindow as minimizeWindowState,
  replaceWidgetBounds,
  restoreWindow as restoreWindowState,
  toggleMaximizeWindow as toggleMaximizeWindowState,
} from "@client/domain/desktop/window-layout";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { DesktopDimensions, WindowBounds } from "@client/types/desktop/desktop";
import { useUnsavedChangesWarning } from "@client/hooks/desktop/use-unsaved-changes-warning";
import { useWidgetLayoutAutoSave } from "@client/hooks/widgets/use-widget-layout-auto-save";
import { useDashboardState } from "@client/hooks/widgets/use-dashboard-state";

export function useDashboard(api: DashboardGateway) {
  const { state, dispatch, widgetsRef, retryLoad } = useDashboardState(api);
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
      widgetsRef.current = widgets;
      dispatch({ type: DASHBOARD_ACTION_TYPE.WIDGETS_REPLACED, widgets });
    },
    [],
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

  const replaceAndSave = useCallback(
    (
      update: (
        widgets: readonly DashboardWidget[],
      ) => readonly DashboardWidget[],
    ): void => {
      const widgets = cloneDashboardWidgets(update(widgetsRef.current));
      widgetsRef.current = widgets;
      dispatch({ type: DASHBOARD_ACTION_TYPE.WIDGETS_REPLACED, widgets });
      scheduleLayoutSave(widgets);
    },
    [scheduleLayoutSave],
  );

  const updateWidgetState = useCallback((widget: DashboardWidget): void => {
    const widgets = replaceDashboardWidgetData(widgetsRef.current, widget).map(
      (candidate) => (candidate.id === widget.id ? widget : candidate),
    );
    widgetsRef.current = widgets;
    dispatch({ type: DASHBOARD_ACTION_TYPE.WIDGETS_REPLACED, widgets });
  }, []);

  const showError = useCallback((error: unknown, fallback: string): void => {
    dispatch({
      type: DASHBOARD_ACTION_TYPE.MESSAGE_SET,
      message: {
        kind: MESSAGE_KIND.ERROR,
        text: errorMessage(error, fallback),
      },
    });
  }, []);

  const addWidget = useCallback(
    async (type: WidgetType, desktop: DesktopDimensions): Promise<void> => {
      const existingSingleton = WIDGET_BEHAVIOR[type].singleton
        ? widgetsRef.current.find((widget) => widget.type === type)
        : undefined;
      if (existingSingleton) {
        replaceAndSave((widgets) =>
          bringWidgetToFront(widgets, existingSingleton.id),
        );
        return;
      }
      if (widgetsRef.current.length >= MAX_OPEN_WIDGET_COUNT) {
        dispatch({
          type: DASHBOARD_ACTION_TYPE.MESSAGE_SET,
          message: { kind: MESSAGE_KIND.ERROR, text: UI_MESSAGES.MAX_WIDGETS },
        });
        return;
      }

      const widgets = widgetsRef.current;
      const policy = WIDGET_WINDOW_POLICY[type];
      const size = {
        width: policy.DEFAULT_WIDTH,
        height: policy.DEFAULT_HEIGHT,
      };
      try {
        const widget = await api.createWidget({
          type,
          position: cascadeWindowPosition(widgets.length, size, desktop),
          size,
        });
        const current = widgetsRef.current;
        const exists = current.some((candidate) => candidate.id === widget.id);
        const merged = exists
          ? current.map((candidate) =>
              candidate.id === widget.id ? widget : candidate,
            )
          : [...current, widget];
        const next = cloneDashboardWidgets(
          bringWidgetToFront(merged, widget.id),
        );
        widgetsRef.current = next;
        dispatch({ type: DASHBOARD_ACTION_TYPE.WIDGETS_REPLACED, widgets: next });
        scheduleLayoutSave(next);
      } catch (error) {
        dispatch({
          type: DASHBOARD_ACTION_TYPE.MESSAGE_SET,
          message: {
            kind: MESSAGE_KIND.ERROR,
            text: errorMessage(error, UI_MESSAGES.SAVE_FAILED),
          },
        });
      }
    },
    [api, replaceAndSave, scheduleLayoutSave],
  );

  const saveWidgetFile = useCallback(
    async (widgetId: string, input: SaveWidgetFileInput): Promise<void> => {
      try {
        const { widget } = await api.saveWidgetFile(widgetId, input);
        updateWidgetState(widget);
      } catch (error) {
        showError(error, UI_MESSAGES.SAVE_FAILED);
        throw error;
      }
    },
    [api, showError, updateWidgetState],
  );

  const openWidget = useCallback(
    async (widgetId: string): Promise<void> => {
      const existing = widgetsRef.current.find((widget) => widget.id === widgetId);
      if (existing) {
        replaceAndSave((widgets) => bringWidgetToFront(widgets, widgetId));
        return;
      }
      try {
        const widget = await api.openWidget(widgetId);
        const opened = {
          ...widget,
          stackOrder:
            Math.max(
              -1,
              ...widgetsRef.current.map((candidate) => candidate.stackOrder),
            ) + 1,
        };
        const next = cloneDashboardWidgets([...widgetsRef.current, opened]);
        widgetsRef.current = next;
        dispatch({ type: DASHBOARD_ACTION_TYPE.WIDGETS_REPLACED, widgets: next });
        scheduleLayoutSave(next);
      } catch (error) {
        showError(error, UI_MESSAGES.LOAD_FAILED);
      }
    },
    [api, replaceAndSave, scheduleLayoutSave, showError],
  );

  const removeWidgets = useCallback(
    (widgetIds: readonly string[]): void => {
      if (widgetIds.length === 0) return;
      const ids = new Set(widgetIds);
      layoutSave.forget(widgetIds);
      const next = widgetsRef.current.filter((widget) => !ids.has(widget.id));
      widgetsRef.current = next;
      dispatch({ type: DASHBOARD_ACTION_TYPE.WIDGETS_REPLACED, widgets: next });
    },
    [layoutSave],
  );

  const closeWidget = useCallback(
    async (widgetId: string): Promise<void> => {
      try {
        await api.closeWidget(widgetId);
        removeWidgets([widgetId]);
      } catch (error) {
        showError(error, UI_MESSAGES.SAVE_FAILED);
        throw error;
      }
    },
    [api, removeWidgets, showError],
  );

  const discardWidget = useCallback(
    async (widgetId: string): Promise<void> => {
      try {
        await api.discardWidget(widgetId);
        removeWidgets([widgetId]);
      } catch (error) {
        showError(error, UI_MESSAGES.SAVE_FAILED);
        throw error;
      }
    },
    [api, removeWidgets, showError],
  );

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

  const dismissMessage = useCallback(() => {
    dispatch({ type: DASHBOARD_ACTION_TYPE.MESSAGE_SET, message: null });
  }, []);

  const updateWidget = useCallback((widget: DashboardWidget) => {
    updateWidgetState(widget);
  }, [updateWidgetState]);

  const currentActiveWidgetId = useMemo(
    () => activeWidgetId(state.widgets),
    [state.widgets],
  );

  return {
    state,
    activeWidgetId: currentActiveWidgetId,
    layoutSave,
    addWidget,
    saveWidgetFile,
    openWidget,
    closeWidget,
    discardWidget,
    removeWidgets,
    focusWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    activateTaskbarWindow,
    commitWindowBounds,
    updateWidget,
    gateway: api,
    retry,
    dismissMessage,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
