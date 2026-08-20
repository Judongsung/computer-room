import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import {
  CHECKLIST_EVENT_ACTION_VALUES,
  CHECKLIST_ITEM_LABEL_MAX_LENGTH,
} from "../src/constants/checklist";
import {
  FILE_STATUS,
  FILE_STATUS_VALUES,
  MAX_FILE_SIZE_BYTES,
} from "../src/constants/file";
import { EMPTY_MEMO_MARKDOWN } from "../src/constants/memo";
import {
  GRID_COLUMN_COUNT,
  GRID_MAX_START_ROW,
  WIDGET_SIZE_LIMITS,
  WIDGET_TYPE,
  WIDGET_TYPE_VALUES,
} from "../src/constants/widget";

const FILE_STATUS_SQL = FILE_STATUS_VALUES.map((status) => `'${status}'`).join(", ");
const WIDGET_TYPE_SQL = WIDGET_TYPE_VALUES.map((type) => `'${type}'`).join(", ");
const CHECKLIST_EVENT_ACTION_SQL = CHECKLIST_EVENT_ACTION_VALUES.map(
  (action) => `'${action}'`,
).join(", ");

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
      .default(WIDGET_TYPE.MEMO),
    gridColumn: integer("grid_column").notNull(),
    gridRow: integer("grid_row").notNull(),
    gridColumns: integer("grid_columns").notNull(),
    gridRows: integer("grid_rows").notNull(),
  },
  (table) => [
    check(
      "dashboard_widgets_type_check",
      sql`${table.type} IN (${sql.raw(WIDGET_TYPE_SQL)})`,
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
      sql`${table.gridColumns} >= ${sql.raw(String(WIDGET_SIZE_LIMITS.MIN_COLUMNS))} AND ${table.gridColumns} <= ${sql.raw(String(WIDGET_SIZE_LIMITS.MAX_COLUMNS))}`,
    ),
    check(
      "dashboard_widgets_height_check",
      sql`${table.gridRows} >= ${sql.raw(String(WIDGET_SIZE_LIMITS.MIN_ROWS))} AND ${table.gridRows} <= ${sql.raw(String(WIDGET_SIZE_LIMITS.MAX_ROWS))}`,
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

export const memoWidgets = sqliteTable("memo_widgets", {
  widgetId: text("widget_id")
    .primaryKey()
    .references(() => dashboardWidgets.id, { onDelete: "cascade" }),
  markdown: text("markdown").notNull().default(EMPTY_MEMO_MARKDOWN),
  updatedAt: integer("updated_at"),
});

export const checklistItems = sqliteTable(
  "checklist_items",
  {
    id: text("id").primaryKey(),
    widgetId: text("widget_id")
      .notNull()
      .references(() => dashboardWidgets.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    archivedAt: integer("archived_at"),
  },
  (table) => [
    check(
      "checklist_items_label_check",
      sql`length(${table.label}) BETWEEN 1 AND ${sql.raw(String(CHECKLIST_ITEM_LABEL_MAX_LENGTH))}`,
    ),
    check("checklist_items_sort_order_check", sql`${table.sortOrder} >= 0`),
    index("idx_checklist_items_widget_order").on(
      table.widgetId,
      table.archivedAt,
      table.sortOrder,
    ),
  ],
);

export const checklistDailyStates = sqliteTable(
  "checklist_daily_states",
  {
    itemId: text("item_id")
      .notNull()
      .references(() => checklistItems.id, { onDelete: "cascade" }),
    businessDate: text("business_date").notNull(),
    checked: integer("checked", { mode: "boolean" }).notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.itemId, table.businessDate] }),
    check(
      "checklist_daily_states_checked_check",
      sql`${table.checked} IN (0, 1)`,
    ),
    index("idx_checklist_daily_states_date").on(table.businessDate),
  ],
);

export const checklistEvents = sqliteTable(
  "checklist_events",
  {
    id: text("id").primaryKey(),
    widgetId: text("widget_id")
      .notNull()
      .references(() => dashboardWidgets.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => checklistItems.id, { onDelete: "cascade" }),
    itemLabel: text("item_label").notNull(),
    action: text("action", { enum: CHECKLIST_EVENT_ACTION_VALUES }).notNull(),
    businessDate: text("business_date").notNull(),
    occurredAt: integer("occurred_at").notNull(),
  },
  (table) => [
    check(
      "checklist_events_action_check",
      sql`${table.action} IN (${sql.raw(CHECKLIST_EVENT_ACTION_SQL)})`,
    ),
    index("idx_checklist_events_widget_time").on(
      table.widgetId,
      table.occurredAt,
      table.id,
    ),
  ],
);
