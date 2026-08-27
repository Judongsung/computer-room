import type {
  CreateWidgetInput,
  DashboardWidget,
} from "@/types/widgets/widget";
import type {
  FilesystemWidgetEntry,
  SaveWidgetFileInput,
} from "@/types/filesystem/filesystem";

export interface WidgetLifecycleGateway {
  createWidget(input: CreateWidgetInput): Promise<DashboardWidget>;
  saveWidgetFile(
    widgetId: string,
    input: SaveWidgetFileInput,
  ): Promise<{ widget: DashboardWidget; entry: FilesystemWidgetEntry }>;
  openWidget(widgetId: string): Promise<DashboardWidget>;
  closeWidget(widgetId: string): Promise<void>;
  discardWidget(widgetId: string): Promise<void>;
}
