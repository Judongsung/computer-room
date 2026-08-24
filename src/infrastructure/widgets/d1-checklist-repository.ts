import {
  CHECKLIST_EVENT_ACTION,
  CHECKLIST_EVENT_ACTION_VALUES,
} from "@/constants/widgets/checklist";
import { CHECKLIST_ERRORS } from "@/constants/widgets/errors/checklist";
import { AppError } from "@/domain/shared/errors";
import type {
  ArchiveChecklistItemRecord,
  ChecklistEventRecord,
  ChecklistItemRecord,
  CreateChecklistItemRecord,
  SetChecklistStateRecord,
  UpdateChecklistItemRecord,
} from "@/types/widgets/checklist";
import type { ChecklistRepository } from "@/types/widgets/checklist-repository";
import type {
  ChecklistEventRow,
  ChecklistItemRow,
  CountRow,
} from "@/types/platform/database";

export class D1ChecklistRepository implements ChecklistRepository {
  constructor(private readonly database: D1Database) {}

  async listAllActiveItems(
    businessDate: string,
  ): Promise<ChecklistItemRecord[]> {
    return this.listActiveItemsByQuery(businessDate);
  }

  async listActiveItems(
    widgetId: string,
    businessDate: string,
  ): Promise<ChecklistItemRecord[]> {
    return this.listActiveItemsByQuery(businessDate, widgetId);
  }

  async countActiveItems(widgetId: string): Promise<number> {
    const row = await this.database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM checklist_items
         WHERE widget_id = ?1 AND archived_at IS NULL`,
      )
      .bind(widgetId)
      .first<CountRow>();

    return row?.count ?? 0;
  }

  async insertItem(record: CreateChecklistItemRecord): Promise<void> {
    await this.database.batch([
      this.database.prepare(
        `INSERT INTO checklist_items (
           id, widget_id, label, sort_order, created_at, updated_at
         )
         SELECT ?1, ?2, ?3,
           COALESCE(MAX(sort_order) + 1, 0), ?4, ?4
         FROM checklist_items
         WHERE widget_id = ?2`,
      ).bind(record.id, record.widgetId, record.label, record.createdAt),
      this.eventStatement().bind(
        record.eventId,
        record.widgetId,
        record.id,
        record.label,
        null,
        CHECKLIST_EVENT_ACTION.ADDED,
        record.businessDate,
        record.createdAt,
      ),
    ]);
  }

  async findActiveItem(
    widgetId: string,
    itemId: string,
    businessDate: string,
  ): Promise<ChecklistItemRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT item.id, item.widget_id, item.label, item.sort_order,
           COALESCE(state.checked, 0) AS checked
         FROM checklist_items AS item
         LEFT JOIN checklist_daily_states AS state
           ON state.item_id = item.id AND state.business_date = ?3
         WHERE item.widget_id = ?1 AND item.id = ?2
           AND item.archived_at IS NULL`,
      )
      .bind(widgetId, itemId, businessDate)
      .first<ChecklistItemRow>();

    return row ? mapChecklistItemRow(row) : null;
  }

  async updateItemLabel(record: UpdateChecklistItemRecord): Promise<void> {
    await this.database.batch([
      this.eventStatement().bind(
        record.eventId,
        record.widgetId,
        record.itemId,
        record.label,
        record.previousLabel,
        CHECKLIST_EVENT_ACTION.RENAMED,
        record.businessDate,
        record.updatedAt,
      ),
      this.database.prepare(
        `UPDATE checklist_items
         SET label = ?3, updated_at = ?4
         WHERE widget_id = ?1 AND id = ?2 AND archived_at IS NULL`,
      ).bind(
        record.widgetId,
        record.itemId,
        record.label,
        record.updatedAt,
      ),
    ]);
  }

  async archiveItem(record: ArchiveChecklistItemRecord): Promise<void> {
    await this.database.batch([
      this.eventStatement().bind(
        record.eventId,
        record.widgetId,
        record.itemId,
        record.itemLabel,
        null,
        CHECKLIST_EVENT_ACTION.DELETED,
        record.businessDate,
        record.archivedAt,
      ),
      this.database.prepare(
        `UPDATE checklist_items
         SET archived_at = ?3, updated_at = ?3
         WHERE widget_id = ?1 AND id = ?2 AND archived_at IS NULL`,
      ).bind(record.widgetId, record.itemId, record.archivedAt),
    ]);
  }

  async setChecked(record: SetChecklistStateRecord): Promise<boolean> {
    const checkedValue = record.checked ? 1 : 0;
    const action = record.checked
      ? CHECKLIST_EVENT_ACTION.CHECKED
      : CHECKLIST_EVENT_ACTION.UNCHECKED;
    const itemExists = `EXISTS (
      SELECT 1 FROM checklist_items
      WHERE id = ?3 AND widget_id = ?2 AND archived_at IS NULL
    )`;
    const stateChanged = `COALESCE((
      SELECT checked FROM checklist_daily_states
      WHERE item_id = ?3 AND business_date = ?6
    ), 0) <> ?5`;

    const results = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO checklist_events (
             id, widget_id, item_id, item_label, previous_item_label,
             action, business_date, occurred_at
           )
           SELECT ?1, ?2, ?3, ?4, NULL, ?7, ?6, ?8
           WHERE ${itemExists} AND ${stateChanged}`,
        )
        .bind(
          record.eventId,
          record.widgetId,
          record.itemId,
          record.itemLabel,
          checkedValue,
          record.businessDate,
          action,
          record.occurredAt,
        ),
      this.database
        .prepare(
          `INSERT INTO checklist_daily_states (
             item_id, business_date, checked, updated_at
           )
           SELECT ?3, ?6, ?5, ?8
           WHERE ${itemExists} AND ${stateChanged}
           ON CONFLICT(item_id, business_date) DO UPDATE SET
             checked = excluded.checked,
             updated_at = excluded.updated_at`,
        )
        .bind(
          record.eventId,
          record.widgetId,
          record.itemId,
          record.itemLabel,
          checkedValue,
          record.businessDate,
          action,
          record.occurredAt,
        ),
    ]);

    return (results[0]?.meta.changes ?? 0) > 0;
  }

  async listEvents(
    widgetId: string,
    offset: number,
    limit: number,
  ): Promise<ChecklistEventRecord[]> {
    const result = await this.database
      .prepare(
        `SELECT id, widget_id, item_id, item_label, previous_item_label, action,
           business_date, occurred_at
         FROM checklist_events
         WHERE widget_id = ?1
         ORDER BY occurred_at DESC, id DESC
         LIMIT ?2 OFFSET ?3`,
      )
      .bind(widgetId, limit, offset)
      .all<ChecklistEventRow>();

    return result.results.map(mapChecklistEventRow);
  }

  private eventStatement(): D1PreparedStatement {
    return this.database.prepare(
      `INSERT INTO checklist_events (
         id, widget_id, item_id, item_label, previous_item_label,
         action, business_date, occurred_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    );
  }

  private async listActiveItemsByQuery(
    businessDate: string,
    widgetId?: string,
  ): Promise<ChecklistItemRecord[]> {
    const widgetFilter = widgetId === undefined ? "" : "AND item.widget_id = ?2";
    const statement = this.database.prepare(
      `SELECT item.id, item.widget_id, item.label, item.sort_order,
         COALESCE(state.checked, 0) AS checked
       FROM checklist_items AS item
       LEFT JOIN checklist_daily_states AS state
         ON state.item_id = item.id AND state.business_date = ?1
       WHERE item.archived_at IS NULL ${widgetFilter}
       ORDER BY item.widget_id ASC, item.sort_order ASC, item.id ASC`,
    );
    const result = await (widgetId === undefined
      ? statement.bind(businessDate)
      : statement.bind(businessDate, widgetId)
    ).all<ChecklistItemRow>();

    return result.results.map(mapChecklistItemRow);
  }
}

function mapChecklistItemRow(row: ChecklistItemRow): ChecklistItemRecord {
  return {
    id: row.id,
    widgetId: row.widget_id,
    label: row.label,
    sortOrder: row.sort_order,
    checked: row.checked === 1,
  };
}

function mapChecklistEventRow(row: ChecklistEventRow): ChecklistEventRecord {
  const action = CHECKLIST_EVENT_ACTION_VALUES.find(
    (candidate) => candidate === row.action,
  );
  if (!action) {
    throw new AppError(CHECKLIST_ERRORS.INVALID_STORED_EVENT);
  }

  return {
    id: row.id,
    widgetId: row.widget_id,
    itemId: row.item_id,
    itemLabel: row.item_label,
    previousItemLabel: row.previous_item_label,
    action,
    businessDate: row.business_date,
    occurredAt: row.occurred_at,
  };
}
