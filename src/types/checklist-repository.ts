import type {
  ArchiveChecklistItemRecord,
  ChecklistEventRecord,
  ChecklistItemRecord,
  CreateChecklistItemRecord,
  SetChecklistStateRecord,
  UpdateChecklistItemRecord,
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
  updateItemLabel(record: UpdateChecklistItemRecord): Promise<void>;
  archiveItem(record: ArchiveChecklistItemRecord): Promise<void>;
  setChecked(record: SetChecklistStateRecord): Promise<boolean>;
  listEvents(
    widgetId: string,
    offset: number,
    limit: number,
  ): Promise<ChecklistEventRecord[]>;
}
