import { CHECKLIST_EVENT_ACTION } from "@/constants/widgets/checklist";
import type { ChecklistRepository } from "@/types/widgets/checklist-repository";
import type { ArchiveChecklistItemRecord, ChecklistEventRecord, ChecklistItemRecord, CreateChecklistItemRecord, SetChecklistStateRecord, UpdateChecklistItemRecord } from "@/types/widgets/checklist";

export class MemoryChecklistRepository implements ChecklistRepository {
  readonly items: ChecklistItemRecord[] = [];
  readonly events: ChecklistEventRecord[] = [];
  readonly states = new Map<string, boolean>();

  async listAllActiveItems(
    businessDate: string,
  ): Promise<ChecklistItemRecord[]> {
    return this.listItemsForDate(this.items, businessDate);
  }

  async listActiveItems(
    widgetId: string,
    businessDate: string,
  ): Promise<ChecklistItemRecord[]> {
    return this.listItemsForDate(
      this.items.filter((item) => item.widgetId === widgetId),
      businessDate,
    );
  }

  async countActiveItems(widgetId: string): Promise<number> {
    return this.items.filter((item) => item.widgetId === widgetId).length;
  }

  async insertItem(record: CreateChecklistItemRecord): Promise<void> {
    this.items.push({
      id: record.id,
      widgetId: record.widgetId,
      label: record.label,
      sortOrder: this.items.filter((item) => item.widgetId === record.widgetId)
        .length,
      checked: false,
    });
    this.events.push({
      id: record.eventId,
      widgetId: record.widgetId,
      itemId: record.id,
      itemLabel: record.label,
      previousItemLabel: null,
      action: CHECKLIST_EVENT_ACTION.ADDED,
      businessDate: record.businessDate,
      occurredAt: record.createdAt,
    });
  }

  async findActiveItem(
    widgetId: string,
    itemId: string,
    businessDate: string,
  ): Promise<ChecklistItemRecord | null> {
    const item = this.items.find(
      (candidate) =>
        candidate.widgetId === widgetId && candidate.id === itemId,
    );
    return item
      ? {
          ...item,
          checked: this.states.get(stateKey(item.id, businessDate)) ?? false,
        }
      : null;
  }

  async updateItemLabel(record: UpdateChecklistItemRecord): Promise<void> {
    const index = this.items.findIndex(
      (item) =>
        item.widgetId === record.widgetId && item.id === record.itemId,
    );
    const item = this.items[index];
    if (item) {
      this.items[index] = { ...item, label: record.label };
      this.events.push({
        id: record.eventId,
        widgetId: record.widgetId,
        itemId: record.itemId,
        itemLabel: record.label,
        previousItemLabel: record.previousLabel,
        action: CHECKLIST_EVENT_ACTION.RENAMED,
        businessDate: record.businessDate,
        occurredAt: record.updatedAt,
      });
    }
  }

  async archiveItem(record: ArchiveChecklistItemRecord): Promise<void> {
    const index = this.items.findIndex(
      (item) =>
        item.widgetId === record.widgetId && item.id === record.itemId,
    );
    if (index >= 0) {
      this.items.splice(index, 1);
      this.events.push({
        id: record.eventId,
        widgetId: record.widgetId,
        itemId: record.itemId,
        itemLabel: record.itemLabel,
        previousItemLabel: null,
        action: CHECKLIST_EVENT_ACTION.DELETED,
        businessDate: record.businessDate,
        occurredAt: record.archivedAt,
      });
    }
  }

  async setChecked(record: SetChecklistStateRecord): Promise<boolean> {
    const key = stateKey(record.itemId, record.businessDate);
    const previous = this.states.get(key) ?? false;
    if (previous === record.checked) {
      return false;
    }
    this.states.set(key, record.checked);
    this.events.push({
      id: record.eventId,
      widgetId: record.widgetId,
      itemId: record.itemId,
      itemLabel: record.itemLabel,
      previousItemLabel: null,
      action: record.checked
        ? CHECKLIST_EVENT_ACTION.CHECKED
        : CHECKLIST_EVENT_ACTION.UNCHECKED,
      businessDate: record.businessDate,
      occurredAt: record.occurredAt,
    });
    return true;
  }

  async listEvents(
    widgetId: string,
    offset: number,
    limit: number,
  ): Promise<ChecklistEventRecord[]> {
    return this.events
      .filter((event) => event.widgetId === widgetId)
      .sort(
        (left, right) =>
          right.occurredAt - left.occurredAt ||
          right.id.localeCompare(left.id),
      )
      .slice(offset, offset + limit)
      .map((event) => ({ ...event }));
  }

  private listItemsForDate(
    items: readonly ChecklistItemRecord[],
    businessDate: string,
  ): ChecklistItemRecord[] {
    return items
      .map((item) => ({
        ...item,
        checked: this.states.get(stateKey(item.id, businessDate)) ?? false,
      }))
      .sort(
        (left, right) =>
          left.widgetId.localeCompare(right.widgetId) ||
          left.sortOrder - right.sortOrder,
      );
  }
}

function stateKey(itemId: string, businessDate: string): string {
  return `${itemId}:${businessDate}`;
}
