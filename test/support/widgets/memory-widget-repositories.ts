import type { StoredWidgetLayout, WidgetLayout } from "@/types/widgets/widget";
import type { WidgetType } from "@/types/widgets/widget";
import type { WidgetLayoutRepository } from "@/types/widgets/widget-repository";
import type { MemoRepository } from "@/types/widgets/memo-repository";
import type { MemoRecord } from "@/types/widgets/memo";

export class MemoryWidgetLayoutRepository implements WidgetLayoutRepository {
  records: StoredWidgetLayout[] = [];

  async list(): Promise<StoredWidgetLayout[]> {
    return structuredClone(
      this.records
        .filter((widget) => widget.isOpen)
        .sort(
          (left, right) =>
            left.stackOrder - right.stackOrder ||
            left.id.localeCompare(right.id),
        ),
    );
  }

  async findById(id: string): Promise<StoredWidgetLayout | null> {
    const widget = this.records.find((record) => record.id === id);
    return widget ? structuredClone(widget) : null;
  }

  async findByType(type: WidgetType): Promise<StoredWidgetLayout | null> {
    const widget = this.records.find((record) => record.type === type);
    return widget ? structuredClone(widget) : null;
  }

  async synchronize(widgets: readonly WidgetLayout[]): Promise<void> {
    const updates = new Map(widgets.map((widget) => [widget.id, widget] as const));
    this.records = this.records.map((widget) => {
      const update = updates.get(widget.id);
      return update ? { ...structuredClone(update), isOpen: true, file: widget.file } : widget;
    });
  }

  async insert(widget: WidgetLayout): Promise<void> {
    this.records.push({ ...structuredClone(widget), isOpen: true, file: null });
  }

  async insertSingleton(widget: WidgetLayout): Promise<boolean> {
    if (this.records.some((record) => record.type === widget.type)) {
      return false;
    }
    await this.insert(widget);
    return true;
  }

  async countOpen(): Promise<number> {
    return this.records.filter((widget) => widget.isOpen).length;
  }

  async setOpen(id: string, isOpen: boolean): Promise<void> {
    this.records = this.records.map((widget) =>
      widget.id === id ? { ...widget, isOpen } : widget,
    );
  }

  async deleteUnsaved(id: string): Promise<boolean> {
    const index = this.records.findIndex(
      (widget) => widget.id === id && widget.file === null,
    );
    if (index < 0) return false;
    this.records.splice(index, 1);
    return true;
  }
}

export class MemoryMemoRepository implements MemoRepository {
  readonly records = new Map<string, MemoRecord>();

  async listAll(): Promise<MemoRecord[]> {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  async upsert(record: MemoRecord): Promise<void> {
    this.records.set(record.widgetId, { ...record });
  }
}
