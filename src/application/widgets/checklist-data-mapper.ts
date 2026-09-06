import type { ChecklistRepeatCycle } from "@/constants/widgets/checklist-repeat";
import { getKoreaDateContext } from "@/domain/shared/korea-date";
import { checklistPeriod } from "@/domain/widgets/checklist-period";
import type { ChecklistItemRecord } from "@/types/widgets/checklist";
import type { ChecklistItem, DailyChecklistData } from "@/types/widgets/widget";

export function toChecklistItem(item: ChecklistItemRecord): ChecklistItem {
  return {
    id: item.id,
    label: item.label,
    checked: item.checked,
    checkedAt: item.checkedAt == null ? null : new Date(item.checkedAt).toISOString(),
  };
}

export function toChecklistData(
  now: number,
  repeatCycle: ChecklistRepeatCycle,
  items: readonly ChecklistItemRecord[],
): DailyChecklistData {
  return {
    businessDate: getKoreaDateContext(now).businessDate,
    repeatCycle,
    nextResetAt: new Date(checklistPeriod(now, repeatCycle).end).toISOString(),
    items: items.map(toChecklistItem),
  };
}
