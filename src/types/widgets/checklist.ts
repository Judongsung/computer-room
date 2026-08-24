import type { ChecklistEventAction } from "@/types/widgets/widget";

export interface ChecklistItemRecord {
  readonly id: string;
  readonly widgetId: string;
  readonly label: string;
  readonly sortOrder: number;
  readonly checked: boolean;
}

export interface ChecklistEventRecord {
  readonly id: string;
  readonly widgetId: string;
  readonly itemId: string;
  readonly itemLabel: string;
  readonly previousItemLabel: string | null;
  readonly action: ChecklistEventAction;
  readonly businessDate: string;
  readonly occurredAt: number;
}

export interface CreateChecklistItemRecord {
  readonly id: string;
  readonly widgetId: string;
  readonly label: string;
  readonly eventId: string;
  readonly businessDate: string;
  readonly createdAt: number;
}

export interface UpdateChecklistItemRecord {
  readonly eventId: string;
  readonly widgetId: string;
  readonly itemId: string;
  readonly previousLabel: string;
  readonly label: string;
  readonly businessDate: string;
  readonly updatedAt: number;
}

export interface ArchiveChecklistItemRecord {
  readonly eventId: string;
  readonly widgetId: string;
  readonly itemId: string;
  readonly itemLabel: string;
  readonly businessDate: string;
  readonly archivedAt: number;
}

export interface SetChecklistStateRecord {
  readonly eventId: string;
  readonly widgetId: string;
  readonly itemId: string;
  readonly itemLabel: string;
  readonly checked: boolean;
  readonly businessDate: string;
  readonly occurredAt: number;
}

export interface ChecklistLabelInput {
  readonly label: string;
}

export interface ChecklistCheckInput {
  readonly checked: boolean;
}
