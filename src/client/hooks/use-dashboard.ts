import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  MAX_OPEN_WIDGET_COUNT,
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_STATE,
} from "../../constants/widget";
import {
  cloneDashboardWidgets,
  replaceDashboardWidgetData,
} from "../../domain/widget-layout";
import type {
  DashboardWidget,
  WidgetType,
} from "../../types/widget";
import type { SaveWidgetFileInput } from "../../types/filesystem";
import {
  DASHBOARD_ACTION_TYPE,
  MESSAGE_KIND,
  UI_MESSAGES,
} from "../constants/dashboard";
import {
  activeWidgetId,
  bringWidgetToFront,
  cascadeWindowPosition,
  minimizeWindow as minimizeWindowState,
  replaceWidgetBounds,
  restoreWindow as restoreWindowState,
  toggleMaximizeWindow as toggleMaximizeWindowState,
} from "../domain/window-layout";
import {
  dashboardReducer,
  INITIAL_DASHBOARD_STATE,
} from "../state/dashboard-reducer";
import type { DashboardGateway } from "../types/api";
import type { DesktopDimensions, WindowBounds } from "../types/desktop";
import { useUnsavedChangesWarning } from "./use-unsaved-changes-warning";
import { useWidgetLayoutAutoSave } from "./use-widget-layout-auto-save";

export function useDashboard(api: DashboardGateway) {
  const [state, dispatch] = useReducer(
    dashboardReducer,
    INITIAL_DASHBOARD_STATE,
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const widgetsRef = useRef<readonly DashboardWidget[]>(state.widgets);
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

  useEffect(() => {
    widgetsRef.current = state.widgets;
  }, [state.widgets]);

  useEffect(() => {
    let active = true;
    dispatch({ type: DASHBOARD_ACTION_TYPE.LOAD_STARTED });

    void Promise.all([api.getSession(), api.listWidgets()])
      .then(([session, widgets]) => {
        if (active) {
          widgetsRef.current = cloneDashboardWidgets(widgets);
          dispatch({
            type: DASHBOARD_ACTION_TYPE.LOAD_SUCCEEDED,
            session,
            widgets,
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          dispatch({
            type: DASHBOARD_ACTION_TYPE.LOAD_FAILED,
            message: errorMessage(error, UI_MESSAGES.LOAD_FAILED),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [api, loadAttempt]);

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
        const next = cloneDashboardWidgets([...widgetsRef.current, widget]);
        widgetsRef.current = next;
        dispatch({ type: DASHBOARD_ACTION_TYPE.WIDGETS_REPLACED, widgets: next });
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
    [api, showError],
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

  const retry = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

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
