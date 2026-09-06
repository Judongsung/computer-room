import type { ChecklistRepeatCycle } from "@/constants/widgets/checklist-repeat";
export interface ChecklistRepeatSettings {
  readonly widgetId: string;
  readonly repeatCycle: ChecklistRepeatCycle;
  readonly version: number;
}
