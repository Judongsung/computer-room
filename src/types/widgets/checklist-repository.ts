import type { ChecklistRepeatCycle } from "@/constants/widgets/checklist-repeat";
import type { ChecklistRepeatSettings } from "@/types/widgets/checklist/repeat";
import type {
  ArchiveChecklistItemRecord,
  ChecklistEventRecord,
  ChecklistItemRecord,
  CreateChecklistItemRecord,
  SetChecklistStateRecord,
  UpdateChecklistItemRecord,
} from "@/types/widgets/checklist";

export interface ChecklistRepository {
  listRepeatSettings(): Promise<ChecklistRepeatSettings[]>;
  changeRepeatCycle(widgetId: string, cycle: ChecklistRepeatCycle, now: number): Promise<void>;
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
