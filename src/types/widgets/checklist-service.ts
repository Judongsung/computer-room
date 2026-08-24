import type {
  ChecklistCheckInput,
  ChecklistLabelInput,
} from "@/types/widgets/checklist";
import type {
  ChecklistItem,
  ChecklistLogPage,
  DailyChecklistData,
} from "@/types/widgets/widget";

export interface ChecklistUseCases {
  getChecklist(widgetId: string): Promise<DailyChecklistData>;
  addItem(
    widgetId: string,
    input: ChecklistLabelInput,
  ): Promise<ChecklistItem>;
  updateItem(
    widgetId: string,
    itemId: string,
    input: ChecklistLabelInput,
  ): Promise<ChecklistItem>;
  deleteItem(widgetId: string, itemId: string): Promise<void>;
  setItemChecked(
    widgetId: string,
    itemId: string,
    input: ChecklistCheckInput,
  ): Promise<ChecklistItem>;
  listLogs(
    widgetId: string,
    offset: number,
    limit: number,
  ): Promise<ChecklistLogPage>;
}
