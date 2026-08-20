import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  BLANK_WIDGET_SIZE,
  MAX_WIDGET_COUNT,
  WIDGET_TYPE,
} from "../../constants/widget";
import {
  cloneWidgetLayouts,
  findFirstAvailablePosition,
  widgetLayoutsEqual,
} from "../../domain/widget-layout";
import type { WidgetLayout } from "../../types/widget";
import {
  DASHBOARD_ACTION_TYPE,
  DASHBOARD_MODE,
  MESSAGE_KIND,
  UI_MESSAGES,
} from "../constants/dashboard";
import type { DashboardGateway } from "../types/api";
import { dashboardReducer, INITIAL_DASHBOARD_STATE } from "../state/dashboard-reducer";
import { useUnsavedChangesWarning } from "./use-unsaved-changes-warning";

export function useDashboard(api: DashboardGateway) {
  const [state, dispatch] = useReducer(
    dashboardReducer,
    INITIAL_DASHBOARD_STATE,
  );
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    dispatch({ type: DASHBOARD_ACTION_TYPE.LOAD_STARTED });

    void Promise.all([api.getSession(), api.listWidgets()])
      .then(([session, widgets]) => {
        if (active) {
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

  const isDirty = useMemo(
    () =>
      state.mode === DASHBOARD_MODE.EDIT &&
      !widgetLayoutsEqual(state.persistedWidgets, state.draftWidgets),
    [state.draftWidgets, state.mode, state.persistedWidgets],
  );
  useUnsavedChangesWarning(isDirty);

  const startEditing = useCallback(() => {
    dispatch({ type: DASHBOARD_ACTION_TYPE.EDIT_STARTED });
  }, []);

  const cancelEditing = useCallback(() => {
    dispatch({ type: DASHBOARD_ACTION_TYPE.EDIT_CANCELLED });
  }, []);

  const replaceDraft = useCallback((widgets: readonly WidgetLayout[]) => {
    dispatch({ type: DASHBOARD_ACTION_TYPE.DRAFT_REPLACED, widgets });
  }, []);

  const addBlankWidget = useCallback(() => {
    if (state.draftWidgets.length >= MAX_WIDGET_COUNT) {
      dispatch({
        type: DASHBOARD_ACTION_TYPE.MESSAGE_SET,
        message: { kind: MESSAGE_KIND.ERROR, text: UI_MESSAGES.MAX_WIDGETS },
      });
      return;
    }

    const size = {
      columns: BLANK_WIDGET_SIZE.DEFAULT_COLUMNS,
      rows: BLANK_WIDGET_SIZE.DEFAULT_ROWS,
    };
    const position = findFirstAvailablePosition(state.draftWidgets, size);
    if (!position) {
      dispatch({
        type: DASHBOARD_ACTION_TYPE.MESSAGE_SET,
        message: {
          kind: MESSAGE_KIND.ERROR,
          text: UI_MESSAGES.NO_AVAILABLE_POSITION,
        },
      });
      return;
    }

    const widget: WidgetLayout = {
      id: crypto.randomUUID(),
      type: WIDGET_TYPE.BLANK,
      position,
      size,
    };
    dispatch({
      type: DASHBOARD_ACTION_TYPE.DRAFT_REPLACED,
      widgets: [...state.draftWidgets, widget],
    });
  }, [state.draftWidgets]);

  const removeWidget = useCallback(
    (id: string) => {
      dispatch({
        type: DASHBOARD_ACTION_TYPE.DRAFT_REPLACED,
        widgets: state.draftWidgets.filter((widget) => widget.id !== id),
      });
    },
    [state.draftWidgets],
  );

  const save = useCallback(async () => {
    if (!isDirty || state.isSaving) {
      return;
    }

    dispatch({ type: DASHBOARD_ACTION_TYPE.SAVE_STARTED });
    try {
      const widgets = await api.replaceWidgets(
        cloneWidgetLayouts(state.draftWidgets),
      );
      dispatch({ type: DASHBOARD_ACTION_TYPE.SAVE_SUCCEEDED, widgets });
    } catch (error) {
      dispatch({
        type: DASHBOARD_ACTION_TYPE.SAVE_FAILED,
        message: errorMessage(error, UI_MESSAGES.SAVE_FAILED),
      });
    }
  }, [api, isDirty, state.draftWidgets, state.isSaving]);

  const retry = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  return {
    state,
    isDirty,
    startEditing,
    cancelEditing,
    replaceDraft,
    addBlankWidget,
    removeWidget,
    save,
    retry,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
