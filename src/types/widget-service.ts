import type { DashboardWidget, WidgetLayout } from "./widget";

export interface WidgetLayoutUseCases {
  listWidgets(): Promise<DashboardWidget[]>;
  replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<DashboardWidget[]>;
}
