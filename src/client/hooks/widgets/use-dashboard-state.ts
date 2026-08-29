import { UI_MESSAGES } from "@client/content/ko/widgets/dashboard";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { cloneDashboardWidgets } from "@/domain/widgets/widget-data";
import type { DashboardWidget } from "@/types/widgets/widget";
import {
  DASHBOARD_ACTION_TYPE,
  MESSAGE_KIND,
} from "@client/constants/widgets/dashboard";
import { dashboardReducer, INITIAL_DASHBOARD_STATE } from "@client/state/widgets/dashboard-reducer";
import type { StatusMessage } from "@client/types/widgets/dashboard";
import type { WidgetLayoutGateway } from "@client/types/widgets/ports/layout";
import type { SessionGateway } from "@client/types/widgets/ports/session";
import { messageFromError } from "@client/errors/error-message";

export function useDashboardState(api: SessionGateway & WidgetLayoutGateway) {
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
          message: messageFromError(error, UI_MESSAGES.LOAD_FAILED),
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

  const setMessage = useCallback((message: StatusMessage | null): void => {
    dispatch({ type: DASHBOARD_ACTION_TYPE.MESSAGE_SET, message });
  }, []);

  const showError = useCallback((error: unknown, fallback: string): void => {
    setMessage({
      kind: MESSAGE_KIND.ERROR,
      text: messageFromError(error, fallback),
    });
  }, [setMessage]);

  const dismissMessage = useCallback((): void => setMessage(null), [setMessage]);
  const retryLoad = useCallback(() => setLoadAttempt((current) => current + 1), []);

  return {
    state,
    widgetsRef,
    replaceWidgets,
    setMessage,
    showError,
    dismissMessage,
    retryLoad,
  } as const;
}
