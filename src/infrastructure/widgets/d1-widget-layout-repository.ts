import { WIDGET_ERRORS } from "@/constants/widgets/errors/widget";
import {
  WIDGET_TYPE_VALUES,
  WINDOW_RESTORE_STATE_VALUES,
  WINDOW_STATE_VALUES,
} from "@/constants/widgets/widget";
import { AppError } from "@/domain/shared/errors";
import type { CountRow, WidgetRow } from "@/types/platform/database";
import type {
  StoredWidgetLayout,
  WidgetLayout,
  WidgetType,
} from "@/types/widgets/widget";
import type { WidgetLayoutRepository } from "@/types/widgets/widget-repository";

const WIDGET_SELECT = `
  SELECT w.id, w.type, w.position_x, w.position_y, w.width, w.height,
         w.window_state, w.restore_state, w.stack_order, w.is_open,
         e.id AS entry_id, e.parent_id AS entry_parent_id,
         e.name AS entry_name
  FROM dashboard_widgets w
  LEFT JOIN filesystem_entries e ON e.widget_id = w.id`;

export class D1WidgetLayoutRepository implements WidgetLayoutRepository {
  constructor(private readonly database: D1Database) {}

  async list(): Promise<StoredWidgetLayout[]> {
    const result = await this.database
      .prepare(
        `${WIDGET_SELECT}
         WHERE w.is_open = 1
         ORDER BY w.stack_order ASC, w.id ASC`,
      )
      .all<WidgetRow>();
    return result.results.map(mapWidgetRow);
  }

  async findById(id: string): Promise<StoredWidgetLayout | null> {
    const row = await this.database
      .prepare(`${WIDGET_SELECT} WHERE w.id = ?1`)
      .bind(id)
      .first<WidgetRow>();
    return row ? mapWidgetRow(row) : null;
  }

  async findByType(type: WidgetType): Promise<StoredWidgetLayout | null> {
    const row = await this.database
      .prepare(`${WIDGET_SELECT} WHERE w.type = ?1 ORDER BY w.id ASC LIMIT 1`)
      .bind(type)
      .first<WidgetRow>();
    return row ? mapWidgetRow(row) : null;
  }

  async synchronize(widgets: readonly WidgetLayout[]): Promise<void> {
    if (widgets.length === 0) return;
    await this.database.batch(
      widgets.map((widget) =>
        this.database
          .prepare(
            `UPDATE dashboard_widgets SET
               position_x = ?2, position_y = ?3, width = ?4, height = ?5,
               window_state = ?6, restore_state = ?7, stack_order = ?8
             WHERE id = ?1 AND type = ?9`,
          )
          .bind(
            widget.id,
            widget.position.x,
            widget.position.y,
            widget.size.width,
            widget.size.height,
            widget.windowState,
            widget.restoreState,
            widget.stackOrder,
            widget.type,
          ),
      ),
    );
  }

  async insert(widget: WidgetLayout): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO dashboard_widgets (
           id, type, position_x, position_y, width, height,
           window_state, restore_state, stack_order, is_open
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1)`,
      )
      .bind(
        widget.id,
        widget.type,
        widget.position.x,
        widget.position.y,
        widget.size.width,
        widget.size.height,
        widget.windowState,
        widget.restoreState,
        widget.stackOrder,
      )
      .run();
  }

  async insertSingleton(widget: WidgetLayout): Promise<boolean> {
    const result = await this.database
      .prepare(
        `INSERT OR IGNORE INTO dashboard_widgets (
           id, type, position_x, position_y, width, height,
           window_state, restore_state, stack_order, is_open
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1)`,
      )
      .bind(
        widget.id,
        widget.type,
        widget.position.x,
        widget.position.y,
        widget.size.width,
        widget.size.height,
        widget.windowState,
        widget.restoreState,
        widget.stackOrder,
      )
      .run();
    return result.meta.changes > 0;
  }

  async countOpen(): Promise<number> {
    const row = await this.database
      .prepare("SELECT COUNT(*) AS count FROM dashboard_widgets WHERE is_open = 1")
      .first<CountRow>();
    return row?.count ?? 0;
  }

  async setOpen(id: string, isOpen: boolean): Promise<void> {
    await this.database
      .prepare("UPDATE dashboard_widgets SET is_open = ?2 WHERE id = ?1")
      .bind(id, isOpen ? 1 : 0)
      .run();
  }

  async deleteUnsaved(id: string): Promise<boolean> {
    const result = await this.database
      .prepare(
        `DELETE FROM dashboard_widgets
         WHERE id = ?1
           AND NOT EXISTS (
             SELECT 1 FROM filesystem_entries WHERE widget_id = ?1
           )`,
      )
      .bind(id)
      .run();
    return result.meta.changes > 0;
  }
}

function mapWidgetRow(row: WidgetRow): StoredWidgetLayout {
  const type = WIDGET_TYPE_VALUES.find((candidate) => candidate === row.type);
  const windowState = WINDOW_STATE_VALUES.find(
    (candidate) => candidate === row.window_state,
  );
  const restoreState = WINDOW_RESTORE_STATE_VALUES.find(
    (candidate) => candidate === row.restore_state,
  );
  const hasFileReference =
    row.entry_id !== null ||
    row.entry_parent_id !== null ||
    row.entry_name !== null;
  if (!type || !windowState || !restoreState) {
    throw new AppError(WIDGET_ERRORS.INVALID_STORED_WIDGET);
  }
  const file = hasFileReference
    ? completeFileReference(row.entry_id, row.entry_parent_id, row.entry_name)
    : null;

  return {
    id: row.id,
    type,
    position: { x: row.position_x, y: row.position_y },
    size: { width: row.width, height: row.height },
    windowState,
    restoreState,
    stackOrder: row.stack_order,
    isOpen: row.is_open === 1,
    file,
  };
}

function completeFileReference(
  entryId: string | null,
  parentId: string | null,
  name: string | null,
) {
  if (!entryId || !parentId || !name) {
    throw new AppError(WIDGET_ERRORS.INVALID_STORED_WIDGET);
  }
  return { entryId, parentId, name };
}
