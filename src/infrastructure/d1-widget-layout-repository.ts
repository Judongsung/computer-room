import { WIDGET_ERRORS } from "../constants/errors/widget";
import { WIDGET_TYPE_VALUES } from "../constants/widget";
import { AppError } from "../domain/errors";
import type { WidgetRow } from "../types/database";
import type { WidgetLayout } from "../types/widget";
import type { WidgetLayoutRepository } from "../types/widget-repository";

export class D1WidgetLayoutRepository implements WidgetLayoutRepository {
  constructor(private readonly database: D1Database) {}

  async list(): Promise<WidgetLayout[]> {
    const result = await this.database
      .prepare(
        `SELECT id, type, grid_column, grid_row, grid_columns, grid_rows
         FROM dashboard_widgets
         ORDER BY grid_row ASC, grid_column ASC, id ASC`,
      )
      .all<WidgetRow>();

    return result.results.map(mapWidgetRow);
  }

  async findById(id: string): Promise<WidgetLayout | null> {
    const row = await this.database
      .prepare(
        `SELECT id, type, grid_column, grid_row, grid_columns, grid_rows
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
              id, type, grid_column, grid_row, grid_columns, grid_rows
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(id) DO UPDATE SET
              grid_column = excluded.grid_column,
              grid_row = excluded.grid_row,
              grid_columns = excluded.grid_columns,
              grid_rows = excluded.grid_rows`,
          )
          .bind(
            widget.id,
            widget.type,
            widget.position.column,
            widget.position.row,
            widget.size.columns,
            widget.size.rows,
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
  if (!type) {
    throw new AppError(WIDGET_ERRORS.INVALID_STORED_WIDGET);
  }

  return {
    id: row.id,
    type,
    position: {
      column: row.grid_column,
      row: row.grid_row,
    },
    size: {
      columns: row.grid_columns,
      rows: row.grid_rows,
    },
  };
}
