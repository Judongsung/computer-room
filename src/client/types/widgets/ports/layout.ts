import type { DashboardWidget, WidgetLayout } from "@/types/widgets/widget";

export interface WidgetLayoutGateway {
  listWidgets(): Promise<DashboardWidget[]>;
  replaceWidgets(widgets: readonly WidgetLayout[]): Promise<DashboardWidget[]>;
}
