export const CHECKLIST_REPEAT_CYCLES = ["daily", "weekly", "monthly"] as const;
export type ChecklistRepeatCycle = (typeof CHECKLIST_REPEAT_CYCLES)[number];
export const DEFAULT_CHECKLIST_REPEAT_CYCLE = "daily";
export const CHECKLIST_WRITE_RETRY_LIMIT = 3;
