import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import { applyD1Migrations, env } from "cloudflare:test";
import { expect, it } from "vitest";
import { ChecklistRetentionJob } from "@/application/widgets/checklist-retention-job";
import { D1ChecklistRetentionRepository } from "@/infrastructure/widgets/d1-checklist-retention-repository";
import { FILESYSTEM_ENTRY_SELECT } from "@/infrastructure/filesystem/d1/filesystem-entry-select";
import { directoryOrderClause } from "@/infrastructure/filesystem/d1/d1-directory-order";
import { FILESYSTEM_SORT_FIELD, FILESYSTEM_SORT_DIRECTION } from "@/constants/filesystem/sort";

it("preserves records and constraints while improving index plans and applying opt-in retention", async () => {
  const testEnv = env as typeof env & {
    INDEX_RETENTION_TEST_DB: D1Database;
    TEST_MIGRATIONS: D1Migration[];
  };
  const db = testEnv.INDEX_RETENTION_TEST_DB;
  const index = testEnv.TEST_MIGRATIONS.findIndex((m) => m.name.startsWith("0015_"));
  expect(index).toBeGreaterThan(0);
  await applyD1Migrations(db, testEnv.TEST_MIGRATIONS.slice(0, index));
  await db.batch([
    db.prepare(`INSERT INTO dashboard_widgets(id, type, position_x, position_y, width, height, stack_order)
      VALUES ('retention-widget', 'daily-checklist', 0, 0, 300, 300, 0)`),
    db.prepare(`INSERT INTO checklist_items(id, widget_id, label, sort_order, created_at, updated_at)
      VALUES ('retention-item', 'retention-widget', 'preserved', 0, 1, 1)`),
    db.prepare(`INSERT INTO filesystem_entries(id, parent_id, kind, name, name_key, created_at, updated_at)
      VALUES ('restore-folder', 'system-documents-root', 'directory', 'Folder', 'folder', 1, 1)`),
    db.prepare(`INSERT INTO filesystem_entries(id, parent_id, kind, name, name_key, restore_parent_id, trashed_at, created_at, updated_at)
      VALUES ('trash-folder', 'system-recycle-bin-root', 'directory', 'Trash', 'trash', 'restore-folder', 1, 1, 1)`),
    db.prepare("INSERT INTO desktop_entry_order(entry_id, sort_order) VALUES ('restore-folder', 0)"),
  ]);
  const cutoff = Date.parse("2026-09-04T00:00:00+09:00");
  for (const [id, date, time] of [
    ["old", "2026-09-03", cutoff - 1],
    ["boundary", "2026-09-04", cutoff],
    ["today", "2026-09-05", cutoff + 86_400_000],
  ] as const) {
    await db.batch([
      db.prepare(`INSERT INTO checklist_events(id, widget_id, item_id, item_label, action, business_date, occurred_at)
        VALUES (?1, 'retention-widget', 'retention-item', 'preserved', 'checked', ?2, ?3)`).bind(id, date, time),
      db.prepare(`INSERT INTO checklist_daily_states(item_id, business_date, checked, updated_at)
        VALUES ('retention-item', ?1, 1, ?2)`).bind(date, time),
    ]);
  }
  const tables = (await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations' ORDER BY name",
  ).all<{ name: string }>()).results;
  const snapshot = async () => Promise.all(tables.map(async ({ name }) =>
    (await db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()).results));
  const before = await snapshot();
  await applyD1Migrations(db, testEnv.TEST_MIGRATIONS.slice(index));
  expect(await snapshot()).toEqual(before);
  expect((await db.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);

  const plan = async (sql: string, bindings: (string | number)[] = []) =>
    (await db.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind(...bindings)
      .all<{ detail: string }>()).results.map((row) => row.detail).join("\n");
  expect(await plan("SELECT entry_id FROM desktop_entry_order ORDER BY sort_order"))
    .toContain("desktop_entry_order_sort_order_unique");
  expect(await plan("SELECT rowid FROM checklist_events WHERE item_id = ?1", ["retention-item"]))
    .toContain("SEARCH");
  expect(await plan("SELECT rowid FROM filesystem_entries WHERE restore_parent_id = ?1", ["restore-folder"]))
    .toContain("SEARCH");
  const namePlan = await plan(`${FILESYSTEM_ENTRY_SELECT}
    WHERE e.parent_id = ?1 AND e.trashed_at IS NULL
      AND (e.kind = ?2 OR (e.kind = ?3 AND f.status = ?4) OR (e.kind = ?5 AND w.id IS NOT NULL))
    ORDER BY ${directoryOrderClause({ field: FILESYSTEM_SORT_FIELD.NAME, direction: FILESYSTEM_SORT_DIRECTION.ASCENDING })} LIMIT ?6 OFFSET ?7`,
  ["system-documents-root", "directory", "file", "ready", "widget", 50, 0]);
  expect(namePlan).toContain("idx_filesystem_entries_active_name");
  expect(namePlan).not.toContain("TEMP B-TREE");
  await expect(db.prepare("INSERT INTO desktop_entry_order(entry_id, sort_order) VALUES ('trash-folder', 0)").run())
    .rejects.toThrow();

  const repository = new D1ChecklistRetentionRepository(db);
  const job = new ChecklistRetentionJob(repository);
  const now = Date.parse("2026-09-05T00:00:00+09:00");
  expect(await repository.getSettings()).toEqual({ retentionDays: null });
  expect(await job.run(now)).toBe(0);
  expect(await snapshot()).toEqual(before);
  await repository.saveRetentionDays(1);
  expect(await job.run(now)).toBe(2);
  expect((await db.prepare("SELECT id FROM checklist_events ORDER BY occurred_at").all()).results)
    .toEqual([{ id: "boundary" }, { id: "today" }]);
  expect((await db.prepare("SELECT business_date FROM checklist_daily_states ORDER BY business_date").all()).results)
    .toEqual([{ business_date: "2026-09-04" }, { business_date: "2026-09-05" }]);
  expect(await job.run(now)).toBe(0);
  await repository.saveRetentionDays(null);
  expect(await job.run(now + 86_400_000 * 10)).toBe(0);
  await expect(repository.saveRetentionDays(0)).rejects.toThrow();
  await expect(repository.saveRetentionDays(1.5)).rejects.toThrow();
  await db.prepare("DELETE FROM filesystem_entries WHERE id = 'restore-folder'").run();
  expect(await db.prepare("SELECT restore_parent_id FROM filesystem_entries WHERE id = 'trash-folder'").first())
    .toEqual({ restore_parent_id: null });
  await db.prepare("DELETE FROM checklist_items WHERE id = 'retention-item'").run();
  expect((await db.prepare("SELECT * FROM checklist_events").all()).results).toEqual([]);
  expect((await db.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
});
