import { UI_MESSAGES } from "@client/content/ko/widgets/dashboard";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { cloneDashboardWidgets } from "@/domain/widgets/widget-data";
import { normalizeWidgetStackOrders } from "@/domain/widgets/widget-layout";
import type { DashboardWidget } from "@/types/widgets/widget";
import {
  DASHBOARD_ACTION_TYPE,
  MESSAGE_KIND,
} from "@client/constants/widgets/dashboard";
import { dashboardReducer, INITIAL_DASHBOARD_STATE } from "@client/state/widgets/dashboard-reducer";
import type { StatusMessage } from "@client/types/widgets/dashboard";
import type { WidgetLayoutGateway } from "@client/types/widgets/ports/layout";
import type { SessionGateway } from "@client/types/widgets/ports/session";
import type { SessionInfo } from "@/types/platform/auth";
import { messageFromError } from "@client/errors/error-message";

export function useDashboardState(
  api: SessionGateway & WidgetLayoutGateway,
  initialSession?: SessionInfo,
) {
  const [state, dispatch] = useReducer(dashboardReducer, INITIAL_DASHBOARD_STATE);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const widgetsRef = useRef<readonly DashboardWidget[]>(state.widgets);

  useEffect(() => {
    widgetsRef.current = state.widgets;
  }, [state.widgets]);

  useEffect(() => {
    let active = true;
    dispatch({ type: DASHBOARD_ACTION_TYPE.LOAD_STARTED });
    void Promise.all([
      initialSession ? Promise.resolve(initialSession) : api.getSession(),
      api.listWidgets(),
    ])
      .then(([session, widgets]) => {
        if (!active) return;
        const normalizedWidgets = cloneDashboardWidgets(
          normalizeWidgetStackOrders(widgets),
        );
        widgetsRef.current = normalizedWidgets;
        dispatch({
          type: DASHBOARD_ACTION_TYPE.LOAD_SUCCEEDED,
          session,
          widgets: normalizedWidgets,
        });
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
  }, [api, initialSession, loadAttempt]);

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
