import type {
  ChecklistEventRecord,
  ChecklistItemRecord,
  CreateChecklistItemRecord,
  SetChecklistStateRecord,
} from "./checklist";

export interface ChecklistRepository {
  listAllActiveItems(businessDate: string): Promise<ChecklistItemRecord[]>;
  listActiveItems(
    widgetId: string,
    businessDate: string,
  ): Promise<ChecklistItemRecord[]>;
  countActiveItems(widgetId: string): Promise<number>;
  insertItem(record: CreateChecklistItemRecord): Promise<void>;
  findActiveItem(
    widgetId: string,
    itemId: string,
    businessDate: string,
  ): Promise<ChecklistItemRecord | null>;
  updateItemLabel(
    widgetId: string,
    itemId: string,
    label: string,
    updatedAt: number,
  ): Promise<void>;
  archiveItem(
    widgetId: string,
    itemId: string,
    archivedAt: number,
  ): Promise<void>;
  setChecked(record: SetChecklistStateRecord): Promise<boolean>;
  listEvents(
    widgetId: string,
    offset: number,
    limit: number,
  ): Promise<ChecklistEventRecord[]>;
}
