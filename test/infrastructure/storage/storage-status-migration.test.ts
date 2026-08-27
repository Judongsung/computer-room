import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import { applyD1Migrations, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";

interface MigrationTestEnvironment {
  readonly MIGRATION_REGRESSION_DB: D1Database;
  readonly TEST_MIGRATIONS: readonly D1Migration[];
}

const MEMO_WIDGET_ID = "migration-memo-widget";
const CHECKLIST_WIDGET_ID = "migration-checklist-widget";
const CHECKLIST_ITEM_ID = "migration-checklist-item";
const CHECKLIST_EVENT_ID = "migration-checklist-event";
const MEMO_ENTRY_ID = "migration-memo-entry";
const CHECKLIST_ENTRY_ID = "migration-checklist-entry";
const TIMESTAMP = 1_777_777_777_000;

describe("storage status widget migration", () => {
  it("preserves widget content, checklist history, files, order, and foreign keys", async () => {
    const testEnvironment = env as typeof env & MigrationTestEnvironment;
    const migrations = testEnvironment.TEST_MIGRATIONS;
    const storageStatusIndex = migrations.findIndex((migration) =>
      migration.name.includes("0007_storage_status_widget"),
    );
    expect(storageStatusIndex).toBeGreaterThanOrEqual(0);
    const previousMigrations = migrations.slice(0, storageStatusIndex);
    const storageStatusMigration = [
      migrationByName(migrations, "0007_storage_status_widget"),
    ];
    const directorySortMigration = [
      migrationByName(migrations, "0008_complex_strong_guy"),
    ];
    const mobilePreferencesMigration = [
      migrationByName(migrations, "0009_mobile_preferences"),
    ];
    const database = testEnvironment.MIGRATION_REGRESSION_DB;

    await applyD1Migrations(database, previousMigrations);
    await seedExistingWidgetData(database);
    await applyD1Migrations(database, storageStatusMigration);

    await expect(rows(database, "SELECT * FROM memo_widgets")).resolves.toEqual([
      {
        widget_id: MEMO_WIDGET_ID,
        markdown: "# preserved memo",
        updated_at: TIMESTAMP,
      },
    ]);
    await expect(rows(database, "SELECT * FROM checklist_items")).resolves.toEqual([
      {
        id: CHECKLIST_ITEM_ID,
        widget_id: CHECKLIST_WIDGET_ID,
        label: "preserved item",
        sort_order: 0,
        created_at: TIMESTAMP,
        updated_at: TIMESTAMP,
        archived_at: null,
      },
    ]);
    await expect(rows(database, "SELECT * FROM checklist_daily_states")).resolves.toEqual([
      {
        item_id: CHECKLIST_ITEM_ID,
        business_date: "2026-08-23",
        checked: 1,
        updated_at: TIMESTAMP,
      },
    ]);
    await expect(rows(database, "SELECT * FROM checklist_events")).resolves.toEqual([
      {
        id: CHECKLIST_EVENT_ID,
        widget_id: CHECKLIST_WIDGET_ID,
        item_id: CHECKLIST_ITEM_ID,
        item_label: "preserved item",
        previous_item_label: null,
        action: "checked",
        business_date: "2026-08-23",
        occurred_at: TIMESTAMP,
      },
    ]);
    await expect(rows(database, "SELECT id, widget_id FROM filesystem_entries WHERE widget_id IS NOT NULL ORDER BY id")).resolves.toEqual([
      { id: CHECKLIST_ENTRY_ID, widget_id: CHECKLIST_WIDGET_ID },
      { id: MEMO_ENTRY_ID, widget_id: MEMO_WIDGET_ID },
    ]);
    await expect(rows(database, "SELECT * FROM desktop_entry_order")).resolves.toEqual([
      { entry_id: MEMO_ENTRY_ID, sort_order: 0 },
    ]);
    await expect(rows(database, "SELECT id, is_open FROM dashboard_widgets ORDER BY id")).resolves.toEqual([
      { id: CHECKLIST_WIDGET_ID, is_open: 1 },
      { id: MEMO_WIDGET_ID, is_open: 0 },
    ]);
    await expect(rows(database, "PRAGMA foreign_key_check")).resolves.toEqual([]);

    await insertStorageWidget(database, "storage-widget-one");
    await expect(insertStorageWidget(database, "storage-widget-two")).rejects.toThrow();

    await applyD1Migrations(database, directorySortMigration);
    await database
      .prepare(
        `INSERT INTO filesystem_directory_preferences(
          directory_id, sort_field, sort_direction
        ) VALUES (?1, 'updatedAt', 'descending')`,
      )
      .bind(FILESYSTEM_ROOT_ID.DOCUMENTS)
      .run();
    await expect(
      rows(database, "SELECT * FROM filesystem_directory_preferences"),
    ).resolves.toEqual([
      {
        directory_id: FILESYSTEM_ROOT_ID.DOCUMENTS,
        sort_field: "updatedAt",
        sort_direction: "descending",
      },
    ]);
    await expect(
      database
        .prepare(
          `INSERT INTO filesystem_directory_preferences(
            directory_id, sort_field, sort_direction
          ) VALUES (?1, 'invalid', 'ascending')`,
        )
        .bind(FILESYSTEM_ROOT_ID.DESKTOP)
        .run(),
    ).rejects.toThrow();
    await database.batch([
      database
        .prepare(
          `INSERT INTO filesystem_entries(
            id, parent_id, kind, name, name_key, file_id, widget_id,
            restore_parent_id, restore_path, trashed_at, created_at, updated_at
          ) VALUES ('temporary-sort-directory', ?1, 'directory',
            'temporary', 'temporary', NULL, NULL, NULL, NULL, NULL, ?2, ?2)`,
        )
        .bind(FILESYSTEM_ROOT_ID.DOCUMENTS, TIMESTAMP),
      database.prepare(
        `INSERT INTO filesystem_directory_preferences(
          directory_id, sort_field, sort_direction
        ) VALUES ('temporary-sort-directory', 'size', 'ascending')`,
      ),
      database.prepare(
        "DELETE FROM filesystem_entries WHERE id = 'temporary-sort-directory'",
      ),
    ]);
    await expect(
      database
        .prepare(
          "SELECT COUNT(*) AS count FROM filesystem_directory_preferences WHERE directory_id = 'temporary-sort-directory'",
        )
        .first("count"),
    ).resolves.toBe(0);
    await expect(rows(database, "PRAGMA foreign_key_check")).resolves.toEqual([]);

    await applyD1Migrations(database, mobilePreferencesMigration);
    await expect(rows(database, "SELECT * FROM mobile_preferences")).resolves.toEqual([
      { singleton_id: 1, wallpaper_entry_id: null },
    ]);
    await database
      .prepare(
        "UPDATE mobile_preferences SET wallpaper_entry_id = ?1 WHERE singleton_id = 1",
      )
      .bind(MEMO_ENTRY_ID)
      .run();
    await database
      .prepare("DELETE FROM filesystem_entries WHERE id = ?1")
      .bind(MEMO_ENTRY_ID)
      .run();
    await expect(rows(database, "SELECT * FROM mobile_preferences")).resolves.toEqual([
      { singleton_id: 1, wallpaper_entry_id: null },
    ]);
    await expect(
      database
        .prepare(
          "INSERT INTO mobile_preferences(singleton_id, wallpaper_entry_id) VALUES (2, NULL)",
        )
        .run(),
    ).rejects.toThrow();
    await expect(rows(database, "PRAGMA foreign_key_check")).resolves.toEqual([]);
  });
});

function migrationByName(
  migrations: readonly D1Migration[],
  name: string,
): D1Migration {
  const migration = migrations.find((candidate) => candidate.name.includes(name));
  if (!migration) throw new Error(`Missing test migration: ${name}`);
  return migration;
}

async function seedExistingWidgetData(database: D1Database): Promise<void> {
  await database.batch([
    widgetStatement(database, MEMO_WIDGET_ID, WIDGET_TYPE.MEMO, 0, 0),
    widgetStatement(
      database,
      CHECKLIST_WIDGET_ID,
      WIDGET_TYPE.DAILY_CHECKLIST,
      1,
      1,
    ),
    database
      .prepare("INSERT INTO memo_widgets(widget_id, markdown, updated_at) VALUES (?1, ?2, ?3)")
      .bind(MEMO_WIDGET_ID, "# preserved memo", TIMESTAMP),
    database
      .prepare(`INSERT INTO checklist_items(
        id, widget_id, label, sort_order, created_at, updated_at, archived_at
      ) VALUES (?1, ?2, ?3, 0, ?4, ?4, NULL)`)
      .bind(CHECKLIST_ITEM_ID, CHECKLIST_WIDGET_ID, "preserved item", TIMESTAMP),
    database
      .prepare("INSERT INTO checklist_daily_states(item_id, business_date, checked, updated_at) VALUES (?1, ?2, 1, ?3)")
      .bind(CHECKLIST_ITEM_ID, "2026-08-23", TIMESTAMP),
    database
      .prepare(`INSERT INTO checklist_events(
        id, widget_id, item_id, item_label, previous_item_label,
        action, business_date, occurred_at
      ) VALUES (?1, ?2, ?3, ?4, NULL, 'checked', ?5, ?6)`)
      .bind(
        CHECKLIST_EVENT_ID,
        CHECKLIST_WIDGET_ID,
        CHECKLIST_ITEM_ID,
        "preserved item",
        "2026-08-23",
        TIMESTAMP,
      ),
    widgetEntryStatement(
      database,
      MEMO_ENTRY_ID,
      FILESYSTEM_ROOT_ID.DESKTOP,
      "memo file",
      MEMO_WIDGET_ID,
    ),
    widgetEntryStatement(
      database,
      CHECKLIST_ENTRY_ID,
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "checklist file",
      CHECKLIST_WIDGET_ID,
    ),
    database
      .prepare("INSERT INTO desktop_entry_order(entry_id, sort_order) VALUES (?1, 0)")
      .bind(MEMO_ENTRY_ID),
  ]);
}

function widgetStatement(
  database: D1Database,
  id: string,
  type: string,
  stackOrder: number,
  isOpen: number,
): D1PreparedStatement {
  return database
    .prepare(`INSERT INTO dashboard_widgets(
      id, type, position_x, position_y, width, height,
      window_state, restore_state, stack_order, is_open
    ) VALUES (?1, ?2, 32, 32, 480, 360, 'normal', 'normal', ?3, ?4)`)
    .bind(id, type, stackOrder, isOpen);
}

function widgetEntryStatement(
  database: D1Database,
  id: string,
  parentId: string,
  name: string,
  widgetId: string,
): D1PreparedStatement {
  return database
    .prepare(`INSERT INTO filesystem_entries(
      id, parent_id, kind, name, name_key, file_id, widget_id,
      restore_parent_id, restore_path, trashed_at, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?4, NULL, ?5, NULL, NULL, NULL, ?6, ?6)`)
    .bind(
      id,
      parentId,
      FILESYSTEM_ENTRY_KIND.WIDGET,
      name,
      widgetId,
      TIMESTAMP,
    );
}

async function insertStorageWidget(database: D1Database, id: string): Promise<void> {
  await widgetStatement(
    database,
    id,
    WIDGET_TYPE.STORAGE_STATUS,
    2,
    1,
  ).run();
}

async function rows(
  database: D1Database,
  query: string,
): Promise<readonly Record<string, unknown>[]> {
  return (await database.prepare(query).all()).results;
}
