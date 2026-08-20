import type { SessionInfo } from "../../types/auth";
import type { WidgetLayout } from "../../types/widget";

export interface DashboardGateway {
  getSession(): Promise<SessionInfo>;
  listWidgets(): Promise<WidgetLayout[]>;
  replaceWidgets(widgets: readonly WidgetLayout[]): Promise<WidgetLayout[]>;
}
