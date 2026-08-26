import type {
  CreateWidgetFileInput,
  WidgetFileDocument,
} from "@/types/widgets/widget-file";

export interface WidgetFileUseCases {
  get(entryId: string): Promise<WidgetFileDocument>;
  create(input: CreateWidgetFileInput): Promise<WidgetFileDocument>;
}
