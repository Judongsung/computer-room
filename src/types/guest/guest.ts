import type {
  FilesystemWidgetEntry,
} from "@/types/filesystem/filesystem";
import type { WIDGET_TYPE } from "@/constants/widgets/widget";
import type {
  DailyChecklistData,
  MemoData,
} from "@/types/widgets/widget";

export interface GuestSessionInfo {
  readonly enabled: boolean;
  readonly loginUrl: string;
}

export type GuestMemoProgramDocument = {
  readonly entry: FilesystemWidgetEntry;
  readonly type: typeof WIDGET_TYPE.MEMO;
  readonly data: MemoData;
};

export type GuestChecklistProgramDocument = {
  readonly entry: FilesystemWidgetEntry;
  readonly type: typeof WIDGET_TYPE.DAILY_CHECKLIST;
  readonly data: DailyChecklistData;
};

export type GuestProgramDocument =
  | GuestMemoProgramDocument
  | GuestChecklistProgramDocument;
