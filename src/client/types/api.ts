import type { SessionInfo } from "../../types/auth";
import type {
  ChecklistItem,
  ChecklistLogPage,
  DailyChecklistData,
  DashboardWidget,
  MemoData,
  WidgetLayout,
} from "../../types/widget";

export interface DashboardGateway {
  getSession(): Promise<SessionInfo>;
  listWidgets(): Promise<DashboardWidget[]>;
  replaceWidgets(widgets: readonly WidgetLayout[]): Promise<DashboardWidget[]>;
  updateMemo(widgetId: string, markdown: string): Promise<MemoData>;
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
