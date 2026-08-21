import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  MAX_WIDGET_COUNT,
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "../../constants/widget";
import {
  cloneDashboardWidgets,
  replaceDashboardWidgetData,
} from "../../domain/widget-layout";
import type {
  DashboardWidget,
  WidgetLayout,
  WidgetType,
} from "../../types/widget";
import {
  DASHBOARD_ACTION_TYPE,
  MESSAGE_KIND,
  UI_MESSAGES,
} from "../constants/dashboard";
import {
  activeWidgetId,
  bringWidgetToFront,
  cascadeWindowPosition,
  minimizeWidget,
  replaceWidgetBounds,
  restoreWidget,
  toggleMaximizeWidget,
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

  const addWidget = useCallback(
    (type: WidgetType, desktop: DesktopDimensions): void => {
      if (widgetsRef.current.length >= MAX_WIDGET_COUNT) {
        dispatch({
          type: DASHBOARD_ACTION_TYPE.MESSAGE_SET,
          message: { kind: MESSAGE_KIND.ERROR, text: UI_MESSAGES.MAX_WIDGETS },
        });
        return;
      }

      replaceAndSave((widgets) => {
        const policy = WIDGET_WINDOW_POLICY[type];
        const size = {
          width: policy.DEFAULT_WIDTH,
          height: policy.DEFAULT_HEIGHT,
        };
        const layout: WidgetLayout = {
          id: crypto.randomUUID(),
          type,
          position: cascadeWindowPosition(widgets.length, size, desktop),
          size,
          windowState: WINDOW_STATE.NORMAL,
          restoreState: WINDOW_RESTORE_STATE.NORMAL,
          stackOrder: nextStackOrder(widgets),
        };
        return [...widgets, WIDGET_FACTORY[type](layout)];
      });
    },
    [replaceAndSave],
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
          widget.id === widgetId ? minimizeWidget(widget) : widget,
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
          widget.id === widgetId ? toggleMaximizeWidget(widget) : widget,
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
              candidate.id === widgetId ? restoreWidget(candidate) : candidate,
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
    const widgets = replaceDashboardWidgetData(widgetsRef.current, widget);
    widgetsRef.current = widgets;
    dispatch({ type: DASHBOARD_ACTION_TYPE.WIDGETS_REPLACED, widgets });
  }, []);

  const currentActiveWidgetId = useMemo(
    () => activeWidgetId(state.widgets),
    [state.widgets],
  );

  return {
    state,
    activeWidgetId: currentActiveWidgetId,
    layoutSave,
    addWidget,
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

const WIDGET_FACTORY = {
  [WIDGET_TYPE.MEMO]: (layout: WidgetLayout): DashboardWidget => ({
    ...layout,
    type: WIDGET_TYPE.MEMO,
    data: { markdown: "", updatedAt: null },
  }),
  [WIDGET_TYPE.DAILY_CHECKLIST]: (
    layout: WidgetLayout,
  ): DashboardWidget => ({
    ...layout,
    type: WIDGET_TYPE.DAILY_CHECKLIST,
    data: { businessDate: "", nextResetAt: "", items: [] },
  }),
} satisfies Record<
  WidgetType,
  (layout: WidgetLayout) => DashboardWidget
>;

function nextStackOrder(widgets: readonly WidgetLayout[]): number {
  return Math.max(-1, ...widgets.map((widget) => widget.stackOrder)) + 1;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
