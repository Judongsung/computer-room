import { CHECKLIST_EVENT_ACTION } from "@/constants/widgets/checklist";
import { CHECKLIST_WRITE_RETRY_LIMIT, type ChecklistRepeatCycle } from "@/constants/widgets/checklist-repeat";
import { CHECKLIST_ERRORS } from "@/constants/widgets/errors/checklist";
import { checklistPeriod, isChecklistRepeatCycle } from "@/domain/widgets/checklist-period";
import { AppError } from "@/domain/shared/errors";
import type { ChecklistRepeatSettings } from "@/types/widgets/checklist/repeat";
import type { SetChecklistStateRecord } from "@/types/widgets/checklist";

export class D1ChecklistRepeat {
  constructor(private readonly db: D1Database) {}

  async list(): Promise<ChecklistRepeatSettings[]> {
    const rows = await this.db.prepare("SELECT widget_id, repeat_cycle, version FROM checklist_repeat_settings")
      .all<{ widget_id: string; repeat_cycle: string; version: number }>();
    return rows.results.map((row) => {
      if (!isChecklistRepeatCycle(row.repeat_cycle)) throw new AppError(CHECKLIST_ERRORS.INVALID_REPEAT_CYCLE);
      return { widgetId: row.widget_id, repeatCycle: row.repeat_cycle, version: row.version };
    });
  }

  private async settings(widgetId: string) {
    const row = await this.db.prepare("SELECT repeat_cycle, version FROM checklist_repeat_settings WHERE widget_id = ?1")
      .bind(widgetId).first<{ repeat_cycle: string; version: number }>();
    if (!row) return { widgetId, repeatCycle: "daily" as const, version: 0 };
    if (!isChecklistRepeatCycle(row.repeat_cycle)) throw new AppError(CHECKLIST_ERRORS.INVALID_REPEAT_CYCLE);
    return { widgetId, repeatCycle: row.repeat_cycle, version: row.version };
  }

  async change(widgetId: string, cycle: ChecklistRepeatCycle, now: number): Promise<void> {
    for (let attempt = 0; attempt < CHECKLIST_WRITE_RETRY_LIMIT; attempt++) {
      const old = await this.settings(widgetId);
      if (old.repeatCycle === cycle) return;
      const source = checklistPeriod(now, old.repeatCycle);
      const target = checklistPeriod(now, cycle);
      const results = await this.db.batch([
        this.db.prepare(`INSERT INTO checklist_repeat_settings(widget_id, repeat_cycle, version)
          VALUES (?1, 'daily', 0) ON CONFLICT DO NOTHING`).bind(widgetId),
        this.db.prepare(`INSERT INTO checklist_period_states(item_id, settings_version, period_start, period_end, checked, checked_at)
          SELECT i.id, ?2 + 1, ?3, ?4, s.checked, s.checked_at
          FROM checklist_items i JOIN checklist_period_states s ON s.item_id = i.id
          JOIN checklist_repeat_settings r ON r.widget_id = i.widget_id
          WHERE i.widget_id = ?1 AND i.archived_at IS NULL AND r.version = ?2
            AND s.settings_version = ?2 AND s.period_start = ?5
          ON CONFLICT DO NOTHING`).bind(widgetId, old.version, target.start, target.end, source.start),
        this.db.prepare(`UPDATE checklist_repeat_settings SET repeat_cycle = ?3, version = version + 1
          WHERE widget_id = ?1 AND version = ?2`).bind(widgetId, old.version, cycle),
      ]);
      if (results[2]?.meta.changes) return;
    }
    throw new AppError(CHECKLIST_ERRORS.CONCURRENT_CHANGE);
  }

  async setChecked(record: SetChecklistStateRecord): Promise<boolean> {
    for (let attempt = 0; attempt < CHECKLIST_WRITE_RETRY_LIMIT; attempt++) {
      const settings = await this.settings(record.widgetId);
      const period = checklistPeriod(record.occurredAt, settings.repeatCycle);
      const guard = `EXISTS (SELECT 1 FROM checklist_items i WHERE i.id = ?3 AND i.widget_id = ?2 AND i.archived_at IS NULL)
        AND COALESCE((SELECT version FROM checklist_repeat_settings WHERE widget_id = ?2), 0) = ?9`;
      const changed = `COALESCE((SELECT checked FROM checklist_period_states
        WHERE item_id = ?3 AND settings_version = ?9 AND period_start = ?10), 0) <> ?5`;
      const args = [record.eventId, record.widgetId, record.itemId, record.itemLabel, record.checked ? 1 : 0,
        record.businessDate, record.checked ? CHECKLIST_EVENT_ACTION.CHECKED : CHECKLIST_EVENT_ACTION.UNCHECKED, record.occurredAt,
        settings.version, period.start, period.end];
      const result = await this.db.batch([
        this.db.prepare(`INSERT INTO checklist_events(id, widget_id, item_id, item_label, previous_item_label, action, business_date, occurred_at)
          SELECT ?1, ?2, ?3, ?4, NULL, ?7, ?6, ?8 WHERE ${guard} AND ${changed}`).bind(...args.slice(0, 10)),
        this.db.prepare(`INSERT INTO checklist_period_states(item_id, settings_version, period_start, period_end, checked, checked_at)
          SELECT ?3, ?9, ?10, ?11, ?5, CASE WHEN ?5 = 1 THEN ?8 ELSE NULL END
          WHERE ${guard} AND ${changed}
          ON CONFLICT(item_id, settings_version, period_start) DO UPDATE SET checked = excluded.checked, checked_at = excluded.checked_at`).bind(...args),
        this.db.prepare("SELECT COALESCE((SELECT version FROM checklist_repeat_settings WHERE widget_id = ?1), 0) AS version").bind(record.widgetId),
      ]);
      if ((result[2]?.results[0] as { version: number }).version === settings.version) return (result[0]?.meta.changes ?? 0) > 0;
    }
    throw new AppError(CHECKLIST_ERRORS.CONCURRENT_CHANGE);
  }
}
