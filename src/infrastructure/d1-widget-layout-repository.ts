import { WIDGET_ERRORS } from "../constants/errors/widget";
import { WIDGET_TYPE } from "../constants/widget";
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

  async replaceAll(widgets: readonly WidgetLayout[]): Promise<void> {
    const statements: D1PreparedStatement[] = [
      this.database.prepare("DELETE FROM dashboard_widgets"),
    ];

    for (const widget of widgets) {
      statements.push(
        this.database
          .prepare(
            `INSERT INTO dashboard_widgets (
              id, type, grid_column, grid_row, grid_columns, grid_rows
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
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

    await this.database.batch(statements);
  }
}

function mapWidgetRow(row: WidgetRow): WidgetLayout {
  if (row.type !== WIDGET_TYPE.BLANK) {
    throw new AppError(WIDGET_ERRORS.INVALID_STORED_WIDGET);
  }

  return {
    id: row.id,
    type: row.type,
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
