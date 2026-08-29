import type { WIDGET_TYPE } from "@/constants/widgets/widget";
import type {
  FilesystemWidgetEntry,
  NewFilesystemWidget,
} from "@/types/filesystem/filesystem";
import type {
  DashboardWidget,
  WidgetLayout,
} from "@/types/widgets/widget";

export interface MemoWidgetFileDraftData {
  readonly markdown: string;
}

export interface ChecklistWidgetFileDraftItem {
  readonly label: string;
  readonly checked: boolean;
}

export interface ChecklistWidgetFileDraftData {
  readonly items: readonly ChecklistWidgetFileDraftItem[];
}

interface CreateWidgetFileBaseInput {
  readonly parentId: string;
  readonly name: string;
}

export type CreateWidgetFileInput = CreateWidgetFileBaseInput &
  (
    | {
        readonly type: typeof WIDGET_TYPE.MEMO;
        readonly data: MemoWidgetFileDraftData;
      }
    | {
        readonly type: typeof WIDGET_TYPE.DAILY_CHECKLIST;
        readonly data: ChecklistWidgetFileDraftData;
      }
  );

export type WidgetFileType = CreateWidgetFileInput["type"];

export type CreateWidgetFileInputByType<T extends WidgetFileType> = Extract<
  CreateWidgetFileInput,
  { readonly type: T }
>;

export interface WidgetFileDocument {
  readonly widget: DashboardWidget;
  readonly entry: FilesystemWidgetEntry;
}

export interface StoredChecklistWidgetFileDraftItem
  extends ChecklistWidgetFileDraftItem {
  readonly id: string;
}

export type WidgetFileDraftContent =
  | {
      readonly type: typeof WIDGET_TYPE.MEMO;
      readonly markdown: string;
    }
  | {
      readonly type: typeof WIDGET_TYPE.DAILY_CHECKLIST;
      readonly businessDate: string;
      readonly items: readonly StoredChecklistWidgetFileDraftItem[];
    };

export type WidgetFileDraftContentByType<T extends WidgetFileType> = Extract<
  WidgetFileDraftContent,
  { readonly type: T }
>;

export interface NewWidgetFileDraft {
  readonly widget: WidgetLayout;
  readonly entry: NewFilesystemWidget;
  readonly createdAt: number;
  readonly content: WidgetFileDraftContent;
}
