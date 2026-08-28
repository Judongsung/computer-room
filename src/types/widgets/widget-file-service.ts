import type {
  CreateWidgetFileInput,
  WidgetFileDocument,
} from "@/types/widgets/widget-file";
import type {
  FilesystemWidgetEntry,
  SaveWidgetFileInput,
} from "@/types/filesystem/filesystem";
import type { DashboardWidget } from "@/types/widgets/widget";

export interface WidgetFileUseCases {
  get(entryId: string): Promise<WidgetFileDocument>;
  create(input: CreateWidgetFileInput): Promise<WidgetFileDocument>;
  save(
    widgetId: string,
    input: SaveWidgetFileInput,
  ): Promise<{ widget: DashboardWidget; entry: FilesystemWidgetEntry }>;
}
