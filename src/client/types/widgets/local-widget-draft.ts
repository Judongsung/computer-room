import type { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { ChecklistItem } from "@/types/widgets/widget";
import type { LOCAL_WIDGET_DRAFT_VERSION } from "@client/constants/widgets/local-widget-draft";

interface LocalWidgetDraftBase {
  readonly version: typeof LOCAL_WIDGET_DRAFT_VERSION;
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LocalMemoWidgetDraft extends LocalWidgetDraftBase {
  readonly type: typeof WIDGET_TYPE.MEMO;
  readonly markdown: string;
}

export interface LocalChecklistWidgetDraft extends LocalWidgetDraftBase {
  readonly type: typeof WIDGET_TYPE.DAILY_CHECKLIST;
  readonly businessDate: string;
  readonly items: readonly ChecklistItem[];
}

export type LocalWidgetDraft =
  | LocalMemoWidgetDraft
  | LocalChecklistWidgetDraft;

export interface LocalWidgetDraftState {
  readonly draft: LocalWidgetDraft | null;
  readonly error: string | null;
}
