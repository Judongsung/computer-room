import type { WIDGET_TYPE } from "../constants/widget";
import type { CHECKLIST_EVENT_ACTION } from "../constants/checklist";

export type WidgetType = (typeof WIDGET_TYPE)[keyof typeof WIDGET_TYPE];

export interface GridPosition {
  readonly column: number;
  readonly row: number;
}

export interface GridSize {
  readonly columns: number;
  readonly rows: number;
}

export interface WidgetLayout {
  readonly id: string;
  readonly type: WidgetType;
  readonly position: GridPosition;
  readonly size: GridSize;
}

export interface WidgetLayoutCollection {
  readonly items: readonly WidgetLayout[];
}

export interface MemoData {
  readonly markdown: string;
  readonly updatedAt: string | null;
}

export interface ChecklistItem {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
}

export interface DailyChecklistData {
  readonly businessDate: string;
  readonly nextResetAt: string;
  readonly items: readonly ChecklistItem[];
}

export type MemoWidget = WidgetLayout & {
  readonly type: typeof WIDGET_TYPE.MEMO;
  readonly data: MemoData;
};

export type DailyChecklistWidget = WidgetLayout & {
  readonly type: typeof WIDGET_TYPE.DAILY_CHECKLIST;
  readonly data: DailyChecklistData;
};

export type DashboardWidget = MemoWidget | DailyChecklistWidget;

export interface DashboardWidgetCollection {
  readonly items: readonly DashboardWidget[];
}

export type ChecklistEventAction =
  (typeof CHECKLIST_EVENT_ACTION)[keyof typeof CHECKLIST_EVENT_ACTION];

export interface ChecklistLogEvent {
  readonly id: string;
  readonly itemId: string;
  readonly itemLabel: string;
  readonly previousItemLabel: string | null;
  readonly action: ChecklistEventAction;
  readonly businessDate: string;
  readonly occurredAt: string;
}

export interface ChecklistLogPage {
  readonly items: readonly ChecklistLogEvent[];
  readonly nextOffset: number | null;
}
