import type { LOAD_STATUS, MESSAGE_KIND } from "@client/constants/widgets/dashboard";
import type { LAYOUT_SAVE_STATUS } from "@client/constants/desktop/layout-save";
import type { SessionInfo } from "@/types/platform/auth";
import type { DashboardWidget, WidgetLayout } from "@/types/widgets/widget";

export type LoadStatus = (typeof LOAD_STATUS)[keyof typeof LOAD_STATUS];
export type MessageKind = (typeof MESSAGE_KIND)[keyof typeof MESSAGE_KIND];
export type LayoutSaveStatus =
  (typeof LAYOUT_SAVE_STATUS)[keyof typeof LAYOUT_SAVE_STATUS];

export interface StatusMessage {
  readonly kind: MessageKind;
  readonly text: string;
}

export interface DashboardState {
  readonly loadStatus: LoadStatus;
  readonly session: SessionInfo | null;
  readonly widgets: readonly DashboardWidget[];
  readonly message: StatusMessage | null;
}

export interface WidgetLayoutAutoSaveController {
  readonly status: LayoutSaveStatus;
  readonly error: string | null;
  readonly hasUnsavedChanges: boolean;
  schedule(widgets: readonly WidgetLayout[]): void;
  forget(widgetIds: readonly string[]): void;
  retry(): void;
}

export interface WidgetLayoutAutoSaveOptions {
  readonly fallbackErrorMessage: string;
  readonly onSaved: (widgets: readonly DashboardWidget[]) => void;
}
