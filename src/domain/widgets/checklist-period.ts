import { CHECKLIST_REPEAT_CYCLES, type ChecklistRepeatCycle } from "@/constants/widgets/checklist-repeat";
import { KOREA_UTC_OFFSET_MILLISECONDS, MILLISECONDS_PER_DAY } from "@/constants/platform/date";

export function isChecklistRepeatCycle(value: unknown): value is ChecklistRepeatCycle {
  return CHECKLIST_REPEAT_CYCLES.some((cycle) => cycle === value);
}

export function checklistPeriod(timestamp: number, cycle: ChecklistRepeatCycle) {
  const local = new Date(timestamp + KOREA_UTC_OFFSET_MILLISECONDS);
  let start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  let end: number;
  if (cycle === "monthly") {
    start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
    end = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1);
  } else {
    if (cycle === "weekly") start -= ((local.getUTCDay() + 6) % 7) * MILLISECONDS_PER_DAY;
    end = start + (cycle === "weekly" ? 7 : 1) * MILLISECONDS_PER_DAY;
  }
  return { start: new Date(start).toISOString().slice(0, 10), end: end - KOREA_UTC_OFFSET_MILLISECONDS };
}
