import { CHECKLIST_RETENTION } from "@/constants/widgets/checklist-retention";
import { MILLISECONDS_PER_DAY } from "@/constants/platform/date";
import { getKoreaDateContext } from "@/domain/shared/korea-date";

export function isChecklistRetentionDays(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value)
    && value >= CHECKLIST_RETENTION.MIN_DAYS && value <= CHECKLIST_RETENTION.MAX_DAYS);
}

export function checklistRetentionCutoff(referenceTime: number, retentionDays: number) {
  const timestamp = getKoreaDateContext(referenceTime).nextResetAt
    - (retentionDays + 1) * MILLISECONDS_PER_DAY;
  return { timestamp, businessDate: getKoreaDateContext(timestamp).businessDate };
}
