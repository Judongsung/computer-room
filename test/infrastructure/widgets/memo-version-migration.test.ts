import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import { applyD1Migrations, env } from "cloudflare:test";
import { expect, it } from "vitest";

it("backfills memo history with original timestamps, including null", async () => {
  const testEnvironment = env as typeof env & {
    MIGRATION_REGRESSION_DB: D1Database;
    TEST_MIGRATIONS: readonly D1Migration[];
  };
  const database = testEnvironment.MIGRATION_REGRESSION_DB;
  const migrations = testEnvironment.TEST_MIGRATIONS;
  const versionIndex = migrations.findIndex(migration => migration.name.includes("0019_memo_versions"));
  expect(versionIndex).toBeGreaterThan(0);
  await applyD1Migrations(database, migrations.slice(0, versionIndex));
  await database.batch([
    database.prepare(
      "INSERT INTO dashboard_widgets (id, type, position_x, position_y, width, height, stack_order) VALUES ('dated', 'memo', 0, 0, 320, 300, 0), ('undated', 'memo', 0, 0, 320, 300, 1)",
    ),
    database.prepare(
      "INSERT INTO memo_widgets (widget_id, markdown, updated_at) VALUES ('dated', 'old', 123), ('undated', '', NULL)",
    ),
  ]);
  await applyD1Migrations(database, migrations.slice(versionIndex));
  const history = await database.prepare(
    "SELECT widget_id, version, markdown, saved_at FROM memo_versions ORDER BY widget_id",
  ).all();
  expect(history.results).toEqual([
    { widget_id: "dated", version: 1, markdown: "old", saved_at: 123 },
    { widget_id: "undated", version: 1, markdown: "", saved_at: null },
  ]);
  expect((await database.prepare("SELECT widget_id, markdown, updated_at FROM memo_widgets ORDER BY widget_id").all()).results)
    .toEqual([
      { widget_id: "dated", markdown: "old", updated_at: 123 },
      { widget_id: "undated", markdown: "", updated_at: null },
    ]);
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
  await database.prepare("DELETE FROM dashboard_widgets WHERE id = 'dated'").run();
  expect((await database.prepare("SELECT version FROM memo_versions WHERE widget_id = 'dated'").all()).results).toEqual([]);
});
