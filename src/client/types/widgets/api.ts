import type { SessionInfo } from "@/types/platform/auth";
import type {
  ChecklistItem,
  ChecklistLogPage,
  DailyChecklistData,
  DashboardWidget,
  CreateWidgetInput,
  MemoData,
  WidgetLayout,
} from "@/types/widgets/widget";
import type {
  FilesystemWidgetEntry,
  SaveWidgetFileInput,
} from "@/types/filesystem/filesystem";

export interface DashboardGateway {
  getSession(): Promise<SessionInfo>;
  listWidgets(): Promise<DashboardWidget[]>;
  replaceWidgets(widgets: readonly WidgetLayout[]): Promise<DashboardWidget[]>;
  createWidget(input: CreateWidgetInput): Promise<DashboardWidget>;
  saveWidgetFile(
    widgetId: string,
    input: SaveWidgetFileInput,
  ): Promise<{ widget: DashboardWidget; entry: FilesystemWidgetEntry }>;
  openWidget(widgetId: string): Promise<DashboardWidget>;
  closeWidget(widgetId: string): Promise<void>;
  discardWidget(widgetId: string): Promise<void>;
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
