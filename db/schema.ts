import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  FILE_STATUS,
  FILE_STATUS_VALUES,
  MAX_FILE_SIZE_BYTES,
} from "../src/constants/file";
import {
  BLANK_WIDGET_SIZE,
  GRID_COLUMN_COUNT,
  GRID_MAX_START_ROW,
  WIDGET_TYPE,
  WIDGET_TYPE_VALUES,
} from "../src/constants/widget";

const FILE_STATUS_SQL = FILE_STATUS_VALUES.map((status) => `'${status}'`).join(", ");

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    objectKey: text("object_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    etag: text("etag"),
    status: text("status", { enum: FILE_STATUS_VALUES })
      .notNull()
      .default(FILE_STATUS.PENDING),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    check(
      "files_size_check",
      sql`${table.size} >= 0 AND ${table.size} <= ${sql.raw(String(MAX_FILE_SIZE_BYTES))}`,
    ),
    check(
      "files_status_check",
      sql`${table.status} IN (${sql.raw(FILE_STATUS_SQL)})`,
    ),
    index("idx_files_status_created_at").on(table.status, table.createdAt),
  ],
);

export const dashboardWidgets = sqliteTable(
  "dashboard_widgets",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: WIDGET_TYPE_VALUES })
      .notNull()
      .default(WIDGET_TYPE.BLANK),
    gridColumn: integer("grid_column").notNull(),
    gridRow: integer("grid_row").notNull(),
    gridColumns: integer("grid_columns").notNull(),
    gridRows: integer("grid_rows").notNull(),
  },
  (table) => [
    check(
      "dashboard_widgets_type_check",
      sql`${table.type} = ${sql.raw(`'${WIDGET_TYPE.BLANK}'`)}`,
    ),
    check(
      "dashboard_widgets_column_check",
      sql`${table.gridColumn} >= 0 AND ${table.gridColumn} < ${sql.raw(String(GRID_COLUMN_COUNT))}`,
    ),
    check(
      "dashboard_widgets_row_check",
      sql`${table.gridRow} >= 0 AND ${table.gridRow} <= ${sql.raw(String(GRID_MAX_START_ROW))}`,
    ),
    check(
      "dashboard_widgets_width_check",
      sql`${table.gridColumns} >= ${sql.raw(String(BLANK_WIDGET_SIZE.MIN_COLUMNS))} AND ${table.gridColumns} <= ${sql.raw(String(BLANK_WIDGET_SIZE.MAX_COLUMNS))}`,
    ),
    check(
      "dashboard_widgets_height_check",
      sql`${table.gridRows} >= ${sql.raw(String(BLANK_WIDGET_SIZE.MIN_ROWS))} AND ${table.gridRows} <= ${sql.raw(String(BLANK_WIDGET_SIZE.MAX_ROWS))}`,
    ),
    check(
      "dashboard_widgets_horizontal_bounds_check",
      sql`${table.gridColumn} + ${table.gridColumns} <= ${sql.raw(String(GRID_COLUMN_COUNT))}`,
    ),
    index("idx_dashboard_widgets_position").on(
      table.gridRow,
      table.gridColumn,
    ),
  ],
);
