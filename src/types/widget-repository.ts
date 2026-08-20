import type { WidgetLayout } from "./widget";

export interface WidgetLayoutRepository {
  list(): Promise<WidgetLayout[]>;
  replaceAll(widgets: readonly WidgetLayout[]): Promise<void>;
}
