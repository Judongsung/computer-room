import type {
  DASHBOARD_MODE,
  LOAD_STATUS,
  MESSAGE_KIND,
} from "../constants/dashboard";
import type { SessionInfo } from "../../types/auth";
import type { WidgetLayout } from "../../types/widget";

export type DashboardMode =
  (typeof DASHBOARD_MODE)[keyof typeof DASHBOARD_MODE];
export type LoadStatus = (typeof LOAD_STATUS)[keyof typeof LOAD_STATUS];
export type MessageKind = (typeof MESSAGE_KIND)[keyof typeof MESSAGE_KIND];

export interface StatusMessage {
  readonly kind: MessageKind;
  readonly text: string;
}

export interface DashboardState {
  readonly loadStatus: LoadStatus;
  readonly mode: DashboardMode;
  readonly session: SessionInfo | null;
  readonly persistedWidgets: readonly WidgetLayout[];
  readonly draftWidgets: readonly WidgetLayout[];
  readonly isSaving: boolean;
  readonly message: StatusMessage | null;
}
