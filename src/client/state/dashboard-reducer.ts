import {
  DASHBOARD_ACTION_TYPE,
  DASHBOARD_MODE,
  LOAD_STATUS,
  MESSAGE_KIND,
  UI_MESSAGES,
} from "../constants/dashboard";
import { cloneWidgetLayouts, sortWidgetLayouts } from "../../domain/widget-layout";
import type { SessionInfo } from "../../types/auth";
import type { WidgetLayout } from "../../types/widget";
import type { DashboardState, StatusMessage } from "../types/dashboard";

export type DashboardAction =
  | { readonly type: typeof DASHBOARD_ACTION_TYPE.LOAD_STARTED }
  | {
      readonly type: typeof DASHBOARD_ACTION_TYPE.LOAD_SUCCEEDED;
      readonly session: SessionInfo;
      readonly widgets: readonly WidgetLayout[];
    }
  | {
      readonly type: typeof DASHBOARD_ACTION_TYPE.LOAD_FAILED;
      readonly message: string;
    }
  | { readonly type: typeof DASHBOARD_ACTION_TYPE.EDIT_STARTED }
  | {
      readonly type: typeof DASHBOARD_ACTION_TYPE.DRAFT_REPLACED;
      readonly widgets: readonly WidgetLayout[];
    }
  | { readonly type: typeof DASHBOARD_ACTION_TYPE.EDIT_CANCELLED }
  | { readonly type: typeof DASHBOARD_ACTION_TYPE.SAVE_STARTED }
  | {
      readonly type: typeof DASHBOARD_ACTION_TYPE.SAVE_SUCCEEDED;
      readonly widgets: readonly WidgetLayout[];
    }
  | {
      readonly type: typeof DASHBOARD_ACTION_TYPE.SAVE_FAILED;
      readonly message: string;
    }
  | {
      readonly type: typeof DASHBOARD_ACTION_TYPE.MESSAGE_SET;
      readonly message: StatusMessage | null;
    };

export const INITIAL_DASHBOARD_STATE: DashboardState = {
  loadStatus: LOAD_STATUS.LOADING,
  mode: DASHBOARD_MODE.VIEW,
  session: null,
  persistedWidgets: [],
  draftWidgets: [],
  isSaving: false,
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
        persistedWidgets: widgets,
        draftWidgets: cloneWidgetLayouts(widgets),
        mode: DASHBOARD_MODE.VIEW,
        isSaving: false,
        message: null,
      };
    }
    case DASHBOARD_ACTION_TYPE.LOAD_FAILED:
      return {
        ...state,
        loadStatus: LOAD_STATUS.ERROR,
        isSaving: false,
        message: { kind: MESSAGE_KIND.ERROR, text: action.message },
      };
    case DASHBOARD_ACTION_TYPE.EDIT_STARTED:
      return {
        ...state,
        mode: DASHBOARD_MODE.EDIT,
        draftWidgets: cloneWidgetLayouts(state.persistedWidgets),
        message: null,
      };
    case DASHBOARD_ACTION_TYPE.DRAFT_REPLACED:
      return {
        ...state,
        draftWidgets: normalizeWidgets(action.widgets),
        message: null,
      };
    case DASHBOARD_ACTION_TYPE.EDIT_CANCELLED:
      return {
        ...state,
        mode: DASHBOARD_MODE.VIEW,
        draftWidgets: cloneWidgetLayouts(state.persistedWidgets),
        message: null,
      };
    case DASHBOARD_ACTION_TYPE.SAVE_STARTED:
      return { ...state, isSaving: true, message: null };
    case DASHBOARD_ACTION_TYPE.SAVE_SUCCEEDED: {
      const widgets = normalizeWidgets(action.widgets);
      return {
        ...state,
        persistedWidgets: widgets,
        draftWidgets: cloneWidgetLayouts(widgets),
        mode: DASHBOARD_MODE.VIEW,
        isSaving: false,
        message: {
          kind: MESSAGE_KIND.SUCCESS,
          text: UI_MESSAGES.SAVE_COMPLETE,
        },
      };
    }
    case DASHBOARD_ACTION_TYPE.SAVE_FAILED:
      return {
        ...state,
        isSaving: false,
        message: { kind: MESSAGE_KIND.ERROR, text: action.message },
      };
    case DASHBOARD_ACTION_TYPE.MESSAGE_SET:
      return { ...state, message: action.message };
  }
}

function normalizeWidgets(widgets: readonly WidgetLayout[]): WidgetLayout[] {
  return sortWidgetLayouts(cloneWidgetLayouts(widgets));
}
