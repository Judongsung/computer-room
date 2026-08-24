import type {
  CreateWidgetInput,
  DashboardWidget,
  WidgetLayout,
  WidgetCreationResult,
} from "./widget";
import type {
  FilesystemWidgetEntry,
  SaveWidgetFileInput,
} from "./filesystem";

export interface WidgetLayoutUseCases {
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
