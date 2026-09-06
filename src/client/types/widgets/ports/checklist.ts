import type { ChecklistRepeatCycle } from "@/constants/widgets/checklist-repeat";
import type {
  ChecklistItem,
  ChecklistLogPage,
  DailyChecklistData,
} from "@/types/widgets/widget";

export interface ChecklistGateway {
  changeChecklistRepeatCycle(widgetId: string, repeatCycle: ChecklistRepeatCycle): Promise<DailyChecklistData>;
  getChecklist(widgetId: string): Promise<DailyChecklistData>;
  addChecklistItem(widgetId: string, label: string): Promise<ChecklistItem>;
  updateChecklistItem(
    widgetId: string,
    itemId: string,
    label: string,
  ): Promise<ChecklistItem>;
  deleteChecklistItem(widgetId: string, itemId: string): Promise<void>;
  setChecklistItemChecked(
    widgetId: string,
    itemId: string,
    checked: boolean,
  ): Promise<ChecklistItem>;
  listChecklistLogs(
    widgetId: string,
    offset?: number,
  ): Promise<ChecklistLogPage>;
}
