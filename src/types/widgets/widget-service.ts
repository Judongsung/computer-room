import type {
  CreateWidgetInput,
  DashboardWidget,
  WidgetLayout,
  WidgetCreationResult,
} from "@/types/widgets/widget";
import type {
  FilesystemWidgetEntry,
  SaveWidgetFileInput,
} from "@/types/filesystem/filesystem";

export interface WidgetReader {
  getWidget(widgetId: string): Promise<DashboardWidget>;
}

export interface WidgetLayoutUseCases extends WidgetReader {
  listWidgets(): Promise<DashboardWidget[]>;
  replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<DashboardWidget[]>;
  createWidget(input: CreateWidgetInput): Promise<WidgetCreationResult>;
  saveWidgetFile(
    widgetId: string,
    input: SaveWidgetFileInput,
  ): Promise<{ widget: DashboardWidget; entry: FilesystemWidgetEntry }>;
  openWidget(widgetId: string): Promise<DashboardWidget>;
  closeWidget(widgetId: string): Promise<void>;
  discardWidget(widgetId: string): Promise<void>;
}
