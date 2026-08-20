import type { WidgetLayout } from "./widget";

export interface WidgetLayoutRepository {
  list(): Promise<WidgetLayout[]>;
  findById(id: string): Promise<WidgetLayout | null>;
  synchronize(widgets: readonly WidgetLayout[]): Promise<void>;
}
