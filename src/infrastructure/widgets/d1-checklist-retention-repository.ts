import { CHECKLIST_RETENTION } from "@/constants/widgets/checklist-retention";
import { CHECKLIST_RETENTION_ERRORS } from "@/constants/widgets/errors/checklist-retention";
import { isChecklistRetentionDays } from "@/domain/widgets/checklist-retention";
import { AppError } from "@/domain/shared/errors";
import type { ChecklistRetentionRepository } from "@/types/widgets/checklist/retention";

export class D1ChecklistRetentionRepository implements ChecklistRetentionRepository {
  constructor(private readonly database: D1Database) {}

  async getSettings() {
    const row = await this.database.prepare(
      "SELECT retention_days FROM checklist_settings WHERE singleton_id = ?1",
    ).bind(CHECKLIST_RETENTION.SETTINGS_ID).first<{ retention_days: number | null }>();
    if (!row || !isChecklistRetentionDays(row.retention_days)) {
      throw new AppError(CHECKLIST_RETENTION_ERRORS.INVALID_SETTINGS);
    }
    return { retentionDays: row.retention_days };
  }

  async saveRetentionDays(retentionDays: number | null): Promise<void> {
    await this.database.prepare(
      `INSERT INTO checklist_settings(singleton_id, retention_days) VALUES (?1, ?2)
       ON CONFLICT(singleton_id) DO UPDATE SET retention_days = excluded.retention_days`,
    ).bind(CHECKLIST_RETENTION.SETTINGS_ID, retentionDays).run();
  }

  async purgeBefore(businessDate: string, timestamp: number): Promise<number> {
    const results = await this.database.batch([
      this.database.prepare("DELETE FROM checklist_daily_states WHERE business_date < ?1").bind(businessDate),
      this.database.prepare("DELETE FROM checklist_events WHERE occurred_at < ?1").bind(timestamp),
    ]);
    return results.reduce((total, result) => total + result.meta.changes, 0);
  }
}
