import { WIDGET_ERRORS } from "../constants/errors/widget";
import {
  WIDGET_TYPE_VALUES,
  WINDOW_RESTORE_STATE_VALUES,
  WINDOW_STATE_VALUES,
} from "../constants/widget";
import { AppError } from "../domain/errors";
import type { WidgetRow } from "../types/database";
import type { WidgetLayout } from "../types/widget";
import type { WidgetLayoutRepository } from "../types/widget-repository";

export class D1WidgetLayoutRepository implements WidgetLayoutRepository {
  constructor(private readonly database: D1Database) {}

  async list(): Promise<WidgetLayout[]> {
    const result = await this.database
      .prepare(
        `SELECT id, type, position_x, position_y, width, height,
                window_state, restore_state, stack_order
         FROM dashboard_widgets
         ORDER BY stack_order ASC, id ASC`,
      )
      .all<WidgetRow>();

    return result.results.map(mapWidgetRow);
  }

  async findById(id: string): Promise<WidgetLayout | null> {
    const row = await this.database
      .prepare(
        `SELECT id, type, position_x, position_y, width, height,
                window_state, restore_state, stack_order
         FROM dashboard_widgets
         WHERE id = ?1`,
      )
      .bind(id)
      .first<WidgetRow>();

    return row ? mapWidgetRow(row) : null;
  }

  async synchronize(widgets: readonly WidgetLayout[]): Promise<void> {
    const statements: D1PreparedStatement[] = [];

    for (const widget of widgets) {
      statements.push(
        this.database
          .prepare(
            `INSERT INTO dashboard_widgets (
              id, type, position_x, position_y, width, height,
              window_state, restore_state, stack_order
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(id) DO UPDATE SET
              position_x = excluded.position_x,
              position_y = excluded.position_y,
              width = excluded.width,
              height = excluded.height,
              window_state = excluded.window_state,
              restore_state = excluded.restore_state,
              stack_order = excluded.stack_order`,
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
          ),
      );
    }

    if (widgets.length === 0) {
      statements.push(this.database.prepare("DELETE FROM dashboard_widgets"));
    } else {
      const placeholders = widgets.map((_, index) => `?${index + 1}`).join(", ");
      statements.push(
        this.database
          .prepare(`DELETE FROM dashboard_widgets WHERE id NOT IN (${placeholders})`)
          .bind(...widgets.map((widget) => widget.id)),
      );
    }

    await this.database.batch(statements);
  }
}

function mapWidgetRow(row: WidgetRow): WidgetLayout {
  const type = WIDGET_TYPE_VALUES.find((candidate) => candidate === row.type);
  const windowState = WINDOW_STATE_VALUES.find(
    (candidate) => candidate === row.window_state,
  );
  const restoreState = WINDOW_RESTORE_STATE_VALUES.find(
    (candidate) => candidate === row.restore_state,
  );
  if (!type || !windowState || !restoreState) {
    throw new AppError(WIDGET_ERRORS.INVALID_STORED_WIDGET);
  }

  return {
    id: row.id,
    type,
    position: {
      x: row.position_x,
      y: row.position_y,
    },
    size: {
      width: row.width,
      height: row.height,
    },
    windowState,
    restoreState,
    stackOrder: row.stack_order,
  };
}
