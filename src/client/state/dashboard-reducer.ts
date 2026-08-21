import {
  DASHBOARD_ACTION_TYPE,
  LOAD_STATUS,
  MESSAGE_KIND,
} from "../constants/dashboard";
import { cloneDashboardWidgets } from "../../domain/widget-layout";
import type { SessionInfo } from "../../types/auth";
import type { DashboardWidget } from "../../types/widget";
import type { DashboardState, StatusMessage } from "../types/dashboard";

export type DashboardAction =
  | { readonly type: typeof DASHBOARD_ACTION_TYPE.LOAD_STARTED }
  | {
      readonly type: typeof DASHBOARD_ACTION_TYPE.LOAD_SUCCEEDED;
      readonly session: SessionInfo;
      readonly widgets: readonly DashboardWidget[];
    }
  | {
      readonly type: typeof DASHBOARD_ACTION_TYPE.LOAD_FAILED;
      readonly message: string;
    }
  | {
      readonly type: typeof DASHBOARD_ACTION_TYPE.WIDGETS_REPLACED;
      readonly widgets: readonly DashboardWidget[];
    }
  | {
      readonly type: typeof DASHBOARD_ACTION_TYPE.MESSAGE_SET;
      readonly message: StatusMessage | null;
    };

export const INITIAL_DASHBOARD_STATE: DashboardState = {
  loadStatus: LOAD_STATUS.LOADING,
  session: null,
  widgets: [],
  message: null,
};

export function dashboardReducer(
  state: DashboardState,
  action: DashboardAction,
): DashboardState {
  switch (action.type) {
    case DASHBOARD_ACTION_TYPE.LOAD_STARTED:
      return {
        ...state,
        loadStatus: LOAD_STATUS.LOADING,
        message: null,
      };
    case DASHBOARD_ACTION_TYPE.LOAD_SUCCEEDED: {
      const widgets = normalizeWidgets(action.widgets);
      return {
        ...state,
        loadStatus: LOAD_STATUS.READY,
        session: action.session,
        widgets,
        message: null,
      };
    }
    case DASHBOARD_ACTION_TYPE.LOAD_FAILED:
      return {
        ...state,
        loadStatus: LOAD_STATUS.ERROR,
        message: { kind: MESSAGE_KIND.ERROR, text: action.message },
      };
    case DASHBOARD_ACTION_TYPE.WIDGETS_REPLACED:
      return {
        ...state,
        widgets: normalizeWidgets(action.widgets),
        message: null,
      };
    case DASHBOARD_ACTION_TYPE.MESSAGE_SET:
      return { ...state, message: action.message };
  }
}

function normalizeWidgets(
  widgets: readonly DashboardWidget[],
): DashboardWidget[] {
  return cloneDashboardWidgets(widgets);
}
