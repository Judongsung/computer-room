import type { WidgetLayout } from "./widget";

export interface WidgetLayoutUseCases {
  listWidgets(): Promise<WidgetLayout[]>;
  replaceWidgets(widgets: readonly WidgetLayout[]): Promise<WidgetLayout[]>;
}
