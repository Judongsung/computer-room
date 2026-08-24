import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  CHECKLIST_EVENT_ACTION_VALUES,
  CHECKLIST_ITEM_LABEL_MAX_LENGTH,
} from "@/constants/widgets/checklist";
import {
  FILE_STATUS,
  FILE_STATUS_VALUES,
  MAX_FILE_SIZE_BYTES,
} from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ENTRY_KIND_VALUES,
} from "@/constants/filesystem/filesystem";
import {
  FILESYSTEM_SORT_DIRECTION_VALUES,
  FILESYSTEM_SORT_FIELD_VALUES,
} from "@/constants/filesystem/sort";
import { EMPTY_MEMO_MARKDOWN } from "@/constants/widgets/memo";
import {
  WIDGET_TYPE,
  WIDGET_TYPE_VALUES,
  WINDOW_POSITION_LIMITS,
  WINDOW_RESTORE_STATE,
  WINDOW_RESTORE_STATE_VALUES,
  WINDOW_SIZE_LIMITS,
  WINDOW_STATE,
  WINDOW_STATE_VALUES,
} from "@/constants/widgets/widget";

const FILE_STATUS_SQL = FILE_STATUS_VALUES.map((status) => `'${status}'`).join(", ");
const FILESYSTEM_ENTRY_KIND_SQL = FILESYSTEM_ENTRY_KIND_VALUES.map(
  (kind) => `'${kind}'`,
).join(", ");
const FILESYSTEM_SORT_FIELD_SQL = FILESYSTEM_SORT_FIELD_VALUES.map(
  (field) => `'${field}'`,
).join(", ");
const FILESYSTEM_SORT_DIRECTION_SQL = FILESYSTEM_SORT_DIRECTION_VALUES.map(
  (direction) => `'${direction}'`,
).join(", ");
const WIDGET_TYPE_SQL = WIDGET_TYPE_VALUES.map((type) => `'${type}'`).join(", ");
const WINDOW_STATE_SQL = WINDOW_STATE_VALUES.map((state) => `'${state}'`).join(", ");
const WINDOW_RESTORE_STATE_SQL = WINDOW_RESTORE_STATE_VALUES.map(
  (state) => `'${state}'`,
).join(", ");
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

export const filesystemEntries = sqliteTable(
  "filesystem_entries",
  {
    id: text("id").primaryKey(),
    parentId: text("parent_id").references(
      (): AnySQLiteColumn => filesystemEntries.id,
      { onDelete: "cascade" },
    ),
    kind: text("kind", { enum: FILESYSTEM_ENTRY_KIND_VALUES }).notNull(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    fileId: text("file_id")
      .unique()
      .references(() => files.id, { onDelete: "cascade" }),
    widgetId: text("widget_id")
      .unique()
      .references((): AnySQLiteColumn => dashboardWidgets.id, {
        onDelete: "cascade",
      }),
    restoreParentId: text("restore_parent_id").references(
      (): AnySQLiteColumn => filesystemEntries.id,
      { onDelete: "set null" },
    ),
    restorePath: text("restore_path"),
    trashedAt: integer("trashed_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    check(
      "filesystem_entries_kind_check",
      sql`${table.kind} IN (${sql.raw(FILESYSTEM_ENTRY_KIND_SQL)})`,
    ),
    check(
      "filesystem_entries_file_check",
      sql`(${table.kind} = ${sql.raw(`'${FILESYSTEM_ENTRY_KIND.DIRECTORY}'`)} AND ${table.fileId} IS NULL AND ${table.widgetId} IS NULL) OR (${table.kind} = ${sql.raw(`'${FILESYSTEM_ENTRY_KIND.FILE}'`)} AND ${table.fileId} IS NOT NULL AND ${table.widgetId} IS NULL) OR (${table.kind} = ${sql.raw(`'${FILESYSTEM_ENTRY_KIND.WIDGET}'`)} AND ${table.fileId} IS NULL AND ${table.widgetId} IS NOT NULL)`,
    ),
    uniqueIndex("uq_filesystem_entries_active_parent_name")
      .on(table.parentId, table.nameKey)
      .where(sql`${table.trashedAt} IS NULL`),
    index("idx_filesystem_entries_parent_kind_name").on(
      table.parentId,
      table.kind,
      table.nameKey,
    ),
    index("idx_filesystem_entries_trash").on(
      table.parentId,
      table.trashedAt,
    ),
  ],
);

export const filesystemDirectoryPreferences = sqliteTable(
  "filesystem_directory_preferences",
  {
    directoryId: text("directory_id")
      .primaryKey()
      .references(() => filesystemEntries.id, { onDelete: "cascade" }),
    sortField: text("sort_field", { enum: FILESYSTEM_SORT_FIELD_VALUES })
      .notNull(),
    sortDirection: text("sort_direction", {
      enum: FILESYSTEM_SORT_DIRECTION_VALUES,
    }).notNull(),
  },
  (table) => [
    check(
      "filesystem_directory_preferences_field_check",
      sql`${table.sortField} IN (${sql.raw(FILESYSTEM_SORT_FIELD_SQL)})`,
    ),
    check(
      "filesystem_directory_preferences_direction_check",
      sql`${table.sortDirection} IN (${sql.raw(FILESYSTEM_SORT_DIRECTION_SQL)})`,
    ),
  ],
);

export const dashboardWidgets = sqliteTable(
  "dashboard_widgets",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: WIDGET_TYPE_VALUES })
      .notNull()
      .default(WIDGET_TYPE.MEMO),
    positionX: integer("position_x").notNull(),
    positionY: integer("position_y").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    windowState: text("window_state", { enum: WINDOW_STATE_VALUES })
      .notNull()
      .default(WINDOW_STATE.NORMAL),
    restoreState: text("restore_state", {
      enum: WINDOW_RESTORE_STATE_VALUES,
    })
      .notNull()
      .default(WINDOW_RESTORE_STATE.NORMAL),
    stackOrder: integer("stack_order").notNull(),
    isOpen: integer("is_open", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    check(
      "dashboard_widgets_type_check",
      sql`${table.type} IN (${sql.raw(WIDGET_TYPE_SQL)})`,
    ),
    check(
      "dashboard_widgets_position_x_check",
      sql`${table.positionX} BETWEEN ${sql.raw(String(WINDOW_POSITION_LIMITS.MIN_X))} AND ${sql.raw(String(WINDOW_POSITION_LIMITS.MAX_X))}`,
    ),
    check(
      "dashboard_widgets_position_y_check",
      sql`${table.positionY} BETWEEN ${sql.raw(String(WINDOW_POSITION_LIMITS.MIN_Y))} AND ${sql.raw(String(WINDOW_POSITION_LIMITS.MAX_Y))}`,
    ),
    check(
      "dashboard_widgets_width_check",
      sql`${table.width} > 0 AND ${table.width} <= ${sql.raw(String(WINDOW_SIZE_LIMITS.MAX_WIDTH))}`,
    ),
    check(
      "dashboard_widgets_height_check",
      sql`${table.height} > 0 AND ${table.height} <= ${sql.raw(String(WINDOW_SIZE_LIMITS.MAX_HEIGHT))}`,
    ),
    check(
      "dashboard_widgets_window_state_check",
      sql`${table.windowState} IN (${sql.raw(WINDOW_STATE_SQL)})`,
    ),
    check(
      "dashboard_widgets_restore_state_check",
      sql`${table.restoreState} IN (${sql.raw(WINDOW_RESTORE_STATE_SQL)})`,
    ),
    check("dashboard_widgets_stack_order_check", sql`${table.stackOrder} >= 0`),
    check("dashboard_widgets_is_open_check", sql`${table.isOpen} IN (0, 1)`),
    index("idx_dashboard_widgets_stack_order").on(table.stackOrder),
    uniqueIndex("uq_dashboard_widgets_storage_status")
      .on(table.type)
      .where(sql`${table.type} = ${sql.raw(`'${WIDGET_TYPE.STORAGE_STATUS}'`)}`),
  ],
);

export const desktopEntryOrder = sqliteTable(
  "desktop_entry_order",
  {
    entryId: text("entry_id")
      .primaryKey()
      .references(() => filesystemEntries.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().unique(),
  },
  (table) => [
    check("desktop_entry_order_value_check", sql`${table.sortOrder} >= 0`),
    index("idx_desktop_entry_order_sort").on(table.sortOrder),
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
    previousItemLabel: text("previous_item_label"),
    action: text("action", { enum: CHECKLIST_EVENT_ACTION_VALUES }).notNull(),
    businessDate: text("business_date").notNull(),
    occurredAt: integer("occurred_at").notNull(),
  },
  (table) => [
    check(
      "checklist_events_action_check",
      sql`${table.action} IN (${sql.raw(CHECKLIST_EVENT_ACTION_SQL)})`,
    ),
    check(
      "checklist_events_previous_label_check",
      sql`${table.previousItemLabel} IS NULL OR length(${table.previousItemLabel}) BETWEEN 1 AND ${sql.raw(String(CHECKLIST_ITEM_LABEL_MAX_LENGTH))}`,
    ),
    index("idx_checklist_events_widget_time").on(
      table.widgetId,
      table.occurredAt,
      table.id,
    ),
  ],
);
