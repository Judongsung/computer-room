import type { StoredWidgetLayout, WidgetLayout } from "./widget";

export interface WidgetLayoutRepository {
  list(): Promise<StoredWidgetLayout[]>;
  findById(id: string): Promise<StoredWidgetLayout | null>;
  synchronize(widgets: readonly WidgetLayout[]): Promise<void>;
  insert(widget: WidgetLayout): Promise<void>;
  countOpen(): Promise<number>;
  setOpen(id: string, isOpen: boolean): Promise<void>;
  deleteUnsaved(id: string): Promise<boolean>;
}
