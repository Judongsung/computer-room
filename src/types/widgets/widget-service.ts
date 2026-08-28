import type {
  CreateWidgetInput,
  DashboardWidget,
  WidgetLayout,
  WidgetCreationResult,
} from "@/types/widgets/widget";

export interface WidgetReader {
  getWidget(widgetId: string): Promise<DashboardWidget>;
}

export interface WidgetLayoutUseCases extends WidgetReader {
  listWidgets(): Promise<DashboardWidget[]>;
  replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<DashboardWidget[]>;
  createWidget(input: CreateWidgetInput): Promise<WidgetCreationResult>;
  openWidget(widgetId: string): Promise<DashboardWidget>;
  closeWidget(widgetId: string): Promise<void>;
  discardWidget(widgetId: string): Promise<void>;
}
