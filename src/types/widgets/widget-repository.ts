import type { StoredWidgetLayout, WidgetLayout } from "@/types/widgets/widget";
import type { WidgetType } from "@/types/widgets/widget";

export interface WidgetLayoutRepository {
  list(): Promise<StoredWidgetLayout[]>;
  findById(id: string): Promise<StoredWidgetLayout | null>;
  findByType(type: WidgetType): Promise<StoredWidgetLayout | null>;
  synchronize(widgets: readonly WidgetLayout[]): Promise<void>;
  insert(widget: WidgetLayout): Promise<void>;
  insertSingleton(widget: WidgetLayout): Promise<boolean>;
  countOpen(): Promise<number>;
  setOpen(id: string, isOpen: boolean): Promise<void>;
  deleteUnsaved(id: string): Promise<boolean>;
}
