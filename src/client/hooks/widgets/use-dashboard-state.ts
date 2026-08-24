import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { cloneDashboardWidgets } from "@/domain/widgets/widget-layout";
import type { DashboardWidget } from "@/types/widgets/widget";
import { DASHBOARD_ACTION_TYPE, UI_MESSAGES } from "@client/constants/widgets/dashboard";
import { dashboardReducer, INITIAL_DASHBOARD_STATE } from "@client/state/widgets/dashboard-reducer";
import type { DashboardGateway } from "@client/types/widgets/api";

export function useDashboardState(api: DashboardGateway) {
  const [state, dispatch] = useReducer(dashboardReducer, INITIAL_DASHBOARD_STATE);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const widgetsRef = useRef<readonly DashboardWidget[]>(state.widgets);

  useEffect(() => {
    widgetsRef.current = state.widgets;
  }, [state.widgets]);

  useEffect(() => {
    let active = true;
    dispatch({ type: DASHBOARD_ACTION_TYPE.LOAD_STARTED });
    void Promise.all([api.getSession(), api.listWidgets()])
      .then(([session, widgets]) => {
        if (!active) return;
        widgetsRef.current = cloneDashboardWidgets(widgets);
        dispatch({ type: DASHBOARD_ACTION_TYPE.LOAD_SUCCEEDED, session, widgets });
      })
      .catch((error: unknown) => {
        if (!active) return;
        dispatch({
          type: DASHBOARD_ACTION_TYPE.LOAD_FAILED,
          message: errorMessage(error, UI_MESSAGES.LOAD_FAILED),
        });
      });
    return () => {
      active = false;
    };
  }, [api, loadAttempt]);

  const replaceWidgets = useCallback((widgets: readonly DashboardWidget[]): void => {
    widgetsRef.current = widgets;
    dispatch({ type: DASHBOARD_ACTION_TYPE.WIDGETS_REPLACED, widgets });
  }, []);

  const retryLoad = useCallback(() => setLoadAttempt((current) => current + 1), []);

  return { state, dispatch, widgetsRef, replaceWidgets, retryLoad } as const;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
