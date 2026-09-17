import { CHECKLIST_REPEAT_CYCLES, DEFAULT_CHECKLIST_REPEAT_CYCLE } from "@/constants/widgets/checklist-repeat";
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
import { MOBILE_PREFERENCES_SINGLETON_ID } from "@/constants/platform/mobile-preferences";
import {
  IMAGE_UPLOAD_CONTENT_TYPE_VALUES,
  IMAGE_UPLOAD_PROFILE_ROOT_IDS,
} from "@/constants/integrations/image-upload-profile";
import {
  IMAGE_UPLOAD_LOG_OUTCOME,
  IMAGE_UPLOAD_LOG_OUTCOME_VALUES,
  IMAGE_UPLOAD_LOG_RETENTION,
  IMAGE_UPLOAD_LOG_SETTINGS_SINGLETON_ID,
} from "@/constants/integrations/image-upload-log";
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
import { GUEST_ACCESS_SETTINGS_SINGLETON_ID } from "@/constants/admin/guest-access";
import { CHECKLIST_RETENTION } from "@/constants/widgets/checklist-retention";

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
const IMAGE_UPLOAD_PROFILE_ROOT_SQL = IMAGE_UPLOAD_PROFILE_ROOT_IDS.map(
  (rootId) => `'${rootId}'`,
).join(", ");
const IMAGE_UPLOAD_CONTENT_TYPE_SQL = IMAGE_UPLOAD_CONTENT_TYPE_VALUES.map(
  (contentType) => `'${contentType}'`,
).join(", ");
const IMAGE_UPLOAD_LOG_OUTCOME_SQL = IMAGE_UPLOAD_LOG_OUTCOME_VALUES.map(
  (outcome) => `'${outcome}'`,
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
    deletionStartedAt: integer("deletion_started_at"),
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
    index("idx_filesystem_entries_active_name")
      .on(
        table.parentId,
        sql`CASE ${table.kind} WHEN ${sql.raw(`'${FILESYSTEM_ENTRY_KIND.DIRECTORY}'`)} THEN 0 ELSE 1 END`,
        table.nameKey,
        table.id,
      )
      .where(sql`${table.trashedAt} IS NULL`),
    index("idx_filesystem_entries_restore_parent")
      .on(table.restoreParentId)
      .where(sql`${table.restoreParentId} IS NOT NULL`),
    index("idx_filesystem_entries_trash").on(
      table.parentId,
      table.trashedAt,
    ),
  ],
);

export const guestAccessSettings = sqliteTable(
  "guest_access_settings",
  {
    singletonId: integer("singleton_id")
      .primaryKey()
      .default(GUEST_ACCESS_SETTINGS_SINGLETON_ID),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    check(
      "guest_access_settings_singleton_check",
      sql`${table.singletonId} = ${sql.raw(String(GUEST_ACCESS_SETTINGS_SINGLETON_ID))}`,
    ),
    check("guest_access_settings_enabled_check", sql`${table.enabled} IN (0, 1)`),
  ],
);

export const guestPublications = sqliteTable("guest_publications", {
  entryId: text("entry_id")
    .primaryKey()
    .references(() => filesystemEntries.id, { onDelete: "cascade" }),
  publishedAt: integer("published_at").notNull(),
});

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

export const mobilePreferences = sqliteTable(
  "mobile_preferences",
  {
    singletonId: integer("singleton_id")
      .primaryKey()
      .default(MOBILE_PREFERENCES_SINGLETON_ID),
    wallpaperEntryId: text("wallpaper_entry_id").references(
      () => filesystemEntries.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    check(
      "mobile_preferences_singleton_check",
      sql`${table.singletonId} = ${sql.raw(String(MOBILE_PREFERENCES_SINGLETON_ID))}`,
    ),
  ],
);

export const integrationImageProfiles = sqliteTable(
  "integration_image_profiles",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    rootId: text("root_id", { enum: IMAGE_UPLOAD_PROFILE_ROOT_IDS }).notNull(),
    pathTemplate: text("path_template").notNull(),
    fileNameTemplate: text("file_name_template").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    check(
      "integration_image_profiles_root_check",
      sql`${table.rootId} IN (${sql.raw(IMAGE_UPLOAD_PROFILE_ROOT_SQL)})`,
    ),
    check(
      "integration_image_profiles_enabled_check",
      sql`${table.enabled} IN (0, 1)`,
    ),
  ],
);

export const integrationImageProfileContentTypes = sqliteTable(
  "integration_image_profile_content_types",
  {
    profileId: text("profile_id")
      .notNull()
      .references(() => integrationImageProfiles.id, { onDelete: "cascade" }),
    contentType: text("content_type", {
      enum: IMAGE_UPLOAD_CONTENT_TYPE_VALUES,
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.contentType] }),
    check(
      "integration_image_profile_content_types_value_check",
      sql`${table.contentType} IN (${sql.raw(IMAGE_UPLOAD_CONTENT_TYPE_SQL)})`,
    ),
  ],
);

export const integrationImageUploadLogs = sqliteTable(
  "integration_image_upload_logs",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id"),
    sourceIp: text("source_ip"),
    outcome: text("outcome", {
      enum: IMAGE_UPLOAD_LOG_OUTCOME_VALUES,
    }).notNull(),
    contentType: text("content_type"),
    declaredSize: integer("declared_size"),
    fileEntryId: text("file_entry_id"),
    fileName: text("file_name"),
    httpStatus: integer("http_status").notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    receivedAt: integer("received_at").notNull(),
    durationMs: integer("duration_ms").notNull(),
  },
  (table) => [
    check(
      "integration_image_upload_logs_outcome_check",
      sql`${table.outcome} IN (${sql.raw(IMAGE_UPLOAD_LOG_OUTCOME_SQL)})`,
    ),
    check(
      "integration_image_upload_logs_declared_size_check",
      sql`${table.declaredSize} IS NULL OR ${table.declaredSize} >= 0`,
    ),
    check(
      "integration_image_upload_logs_http_status_check",
      sql`${table.httpStatus} BETWEEN 100 AND 599`,
    ),
    check(
      "integration_image_upload_logs_duration_check",
      sql`${table.durationMs} >= 0`,
    ),
    check(
      "integration_image_upload_logs_result_check",
      sql`(${table.outcome} = ${sql.raw(`'${IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS}'`)} AND ${table.fileEntryId} IS NOT NULL AND ${table.fileName} IS NOT NULL AND ${table.errorCode} IS NULL AND ${table.errorMessage} IS NULL) OR (${table.outcome} = ${sql.raw(`'${IMAGE_UPLOAD_LOG_OUTCOME.FAILURE}'`)} AND ${table.fileEntryId} IS NULL AND ${table.fileName} IS NULL AND ${table.errorCode} IS NOT NULL AND ${table.errorMessage} IS NOT NULL)`,
    ),
    index("idx_integration_image_upload_logs_time").on(
      table.receivedAt,
      table.id,
    ),
    index("idx_integration_image_upload_logs_profile_time").on(
      table.profileId,
      table.receivedAt,
      table.id,
    ),
  ],
);

export const integrationImageUploadLogSettings = sqliteTable(
  "integration_image_upload_log_settings",
  {
    singletonId: integer("singleton_id")
      .primaryKey()
      .default(IMAGE_UPLOAD_LOG_SETTINGS_SINGLETON_ID),
    retentionDays: integer("retention_days")
      .notNull()
      .default(IMAGE_UPLOAD_LOG_RETENTION.DEFAULT_DAYS),
  },
  (table) => [
    check(
      "integration_image_upload_log_settings_singleton_check",
      sql`${table.singletonId} = ${sql.raw(String(IMAGE_UPLOAD_LOG_SETTINGS_SINGLETON_ID))}`,
    ),
    check(
      "integration_image_upload_log_settings_retention_check",
      sql`${table.retentionDays} BETWEEN ${sql.raw(String(IMAGE_UPLOAD_LOG_RETENTION.MIN_DAYS))} AND ${sql.raw(String(IMAGE_UPLOAD_LOG_RETENTION.MAX_DAYS))}`,
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
    uniqueIndex("uq_dashboard_widgets_image_upload_profiles")
      .on(table.type)
      .where(
        sql`${table.type} = ${sql.raw(`'${WIDGET_TYPE.IMAGE_UPLOAD_PROFILES}'`)}`,
      ),
    uniqueIndex("uq_dashboard_widgets_admin")
      .on(table.type)
      .where(sql`${table.type} = ${sql.raw(`'${WIDGET_TYPE.ADMIN}'`)}`),
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
    index("idx_checklist_events_item").on(table.itemId),
    index("idx_checklist_events_time").on(table.occurredAt),
  ],
);

export const checklistSettings = sqliteTable(
  "checklist_settings",
  {
    singletonId: integer("singleton_id")
      .primaryKey()
      .default(CHECKLIST_RETENTION.SETTINGS_ID),
    retentionDays: integer("retention_days"),
  },
  (table) => [
    check(
      "checklist_settings_singleton_check",
      sql`${table.singletonId} = ${sql.raw(String(CHECKLIST_RETENTION.SETTINGS_ID))}`,
    ),
    check(
      "checklist_settings_retention_check",
      sql`${table.retentionDays} IS NULL OR (${table.retentionDays} BETWEEN ${sql.raw(String(CHECKLIST_RETENTION.MIN_DAYS))} AND ${sql.raw(String(CHECKLIST_RETENTION.MAX_DAYS))} AND typeof(${table.retentionDays}) = 'integer')`,
    ),
  ],
);

export const checklistRepeatSettings = sqliteTable("checklist_repeat_settings", {
  widgetId: text("widget_id").primaryKey().notNull().references(() => dashboardWidgets.id, { onDelete: "cascade" }),
  repeatCycle: text("repeat_cycle", { enum: CHECKLIST_REPEAT_CYCLES }).notNull().default(DEFAULT_CHECKLIST_REPEAT_CYCLE),
  version: integer("version").notNull().default(0),
}, (table) => [
  check("checklist_repeat_cycle_check", sql`${table.repeatCycle} IN ('daily','weekly','monthly')`),
  check("checklist_repeat_version_check", sql`${table.version} >= 0`),
]);

export const checklistPeriodStates = sqliteTable("checklist_period_states", {
  itemId: text("item_id").notNull().references(() => checklistItems.id, { onDelete: "cascade" }),
  settingsVersion: integer("settings_version").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: integer("period_end").notNull(),
  checked: integer("checked", { mode: "boolean" }).notNull(),
  checkedAt: integer("checked_at"),
}, (table) => [
  primaryKey({ columns: [table.itemId, table.settingsVersion, table.periodStart] }),
  index("idx_checklist_period_states_end").on(table.periodEnd),
  check("checklist_period_checked_check", sql`${table.checked} IN (0,1)`),
  check("checklist_period_time_check", sql`(${table.checked} = 0 AND ${table.checkedAt} IS NULL) OR (${table.checked} = 1 AND ${table.checkedAt} IS NOT NULL)`),
]);
