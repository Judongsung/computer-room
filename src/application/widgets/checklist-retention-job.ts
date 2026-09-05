import { BACKGROUND_TASK_FAILURE_CODE } from "@/constants/platform/background-task";
import { checklistRetentionCutoff } from "@/domain/widgets/checklist-retention";
import type { ScheduledJob } from "@/types/platform/scheduled-job";
import type { ChecklistRetentionRepository } from "@/types/widgets/checklist/retention";

export class ChecklistRetentionJob implements ScheduledJob {
  readonly failureCode = BACKGROUND_TASK_FAILURE_CODE.CHECKLIST_RETENTION;

  constructor(private readonly repository: ChecklistRetentionRepository) {}

  async run(scheduledTime: number): Promise<number> {
    const { retentionDays } = await this.repository.getSettings();
    if (retentionDays === null) return 0;
    const cutoff = checklistRetentionCutoff(scheduledTime, retentionDays);
    return this.repository.purgeBefore(cutoff.businessDate, cutoff.timestamp);
  }
}
