import type { StoredWidgetLayout, WidgetLayout } from "@/types/widgets/widget";
import type { WidgetType } from "@/types/widgets/widget";
import type { WidgetLayoutRepository } from "@/types/widgets/widget-repository";
import type { MemoRepository } from "@/types/widgets/memo-repository";
import type { MemoRecord, MemoVersionRecord, MemoVersionSummaryRecord } from "@/types/widgets/memo";
import { MAX_MEMO_VERSIONS } from "@/constants/widgets/memo";

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
      return update
        ? {
            ...structuredClone(update),
            isOpen: widget.isOpen,
            file: widget.file,
          }
        : widget;
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
  readonly versions = new Map<string, MemoVersionRecord[]>();

  async listByWidgetIds(widgetIds: readonly string[]): Promise<MemoRecord[]> {
    const ids = new Set(widgetIds);
    return [...this.records.values()].filter(record => ids.has(record.widgetId)).map((record) => ({ ...record }));
  }

  async upsert(record: MemoRecord): Promise<void> {
    this.records.set(record.widgetId, { ...record });
  }

  async saveWithVersion(record: MemoRecord): Promise<MemoRecord> {
    const current = this.records.get(record.widgetId);
    if (current?.markdown === record.markdown) return { ...current };
    const history = this.versions.get(record.widgetId) ?? [];
    history.push({ version: (history.at(-1)?.version ?? 0) + 1, markdown: record.markdown, savedAt: record.updatedAt });
    if (history.length > MAX_MEMO_VERSIONS) history.shift();
    this.versions.set(record.widgetId, history);
    this.records.set(record.widgetId, { ...record });
    return { ...record };
  }

  async listVersions(widgetId: string): Promise<MemoVersionSummaryRecord[]> {
    return [...(this.versions.get(widgetId) ?? [])].reverse().map(({ version, savedAt }) => ({ version, savedAt }));
  }

  async findVersion(widgetId: string, version: number): Promise<MemoVersionRecord | null> {
    const record = this.versions.get(widgetId)?.find(item => item.version === version);
    return record ? { ...record } : null;
  }
}
