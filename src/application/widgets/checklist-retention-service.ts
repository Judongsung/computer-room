import { CHECKLIST_RETENTION_ERRORS } from "@/constants/widgets/errors/checklist-retention";
import { isChecklistRetentionDays } from "@/domain/widgets/checklist-retention";
import { AppError } from "@/domain/shared/errors";
import type { ChecklistRetentionRepository, ChecklistRetentionUseCases } from "@/types/widgets/checklist/retention";

export class ChecklistRetentionService implements ChecklistRetentionUseCases {
  constructor(private readonly repository: ChecklistRetentionRepository) {}

  getSettings() { return this.repository.getSettings(); }

  async updateRetentionDays(retentionDays: number | null) {
    if (!isChecklistRetentionDays(retentionDays)) {
      throw new AppError(CHECKLIST_RETENTION_ERRORS.INVALID_DAYS);
    }
    await this.repository.saveRetentionDays(retentionDays);
    return { retentionDays };
  }
}
