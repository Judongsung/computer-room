import type {
  CreateWidgetFileInput,
  WidgetFileDocument,
} from "@/types/widgets/widget-file";

export interface WidgetFileGateway {
  getWidgetFile(entryId: string): Promise<WidgetFileDocument>;
  createWidgetFile(input: CreateWidgetFileInput): Promise<WidgetFileDocument>;
}
