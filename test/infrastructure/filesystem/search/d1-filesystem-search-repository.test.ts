import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, expect, it } from "vitest";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import { D1FilesystemSearchRepository } from "@/infrastructure/filesystem/search/d1-filesystem-search-repository";

const testEnv = env as typeof env & {
  TEST_MIGRATIONS: D1Migration[];
  FILESYSTEM_REPOSITORY_TEST_DB: D1Database;
};
const database = testEnv.FILESYSTEM_REPOSITORY_TEST_DB;
const repository = new D1FilesystemSearchRepository(database);

beforeAll(() => applyD1Migrations(database, testEnv.TEST_MIGRATIONS));

it("preserves the full ancestor path when searching descendants of a deep scope and excludes the anchor", async () => {
  await database.batch([
    directory("outer", FILESYSTEM_ROOT_ID.DOCUMENTS, "Outer"),
    directory("middle", "outer", "Middle"),
    directory("scope", "middle", "Needle scope"),
    directory("nested", "scope", "Nested"),
    directory("match", "nested", "Needle descendant"),
    directory("outside", FILESYSTEM_ROOT_ID.DOCUMENTS, "Needle outside"),
  ]);
  const root = await database.prepare("SELECT name FROM filesystem_entries WHERE id = ?1")
    .bind(FILESYSTEM_ROOT_ID.DOCUMENTS).first<{ name: string }>();

  const records = await repository.search({ q: "needle", kind: "all", directoryId: "scope" }, 0, 10);

  expect(records.map(({ entry }) => entry.id)).toEqual(["match"]);
  expect(records[0]?.parentPath).toBe(`${root!.name}/Outer/Middle/Needle scope/Nested`);
  expect(records[0]?.contentMatch).toBeNull();
});

it("excludes scopes with a trashed ancestor or no active system root even when queried directly", async () => {
  await database.batch([
    directory("trashed-parent", FILESYSTEM_ROOT_ID.DESKTOP, "Trashed parent"),
    directory("hidden-scope", "trashed-parent", "Hidden scope"),
    directory("hidden-match", "hidden-scope", "Needle hidden"),
    directory("detached-scope", null, "Detached scope"),
    directory("detached-match", "detached-scope", "Needle detached"),
    database.prepare("UPDATE filesystem_entries SET trashed_at = 1 WHERE id = ?1").bind("trashed-parent"),
  ]);
  expect(await database.prepare("SELECT trashed_at FROM filesystem_entries WHERE id = ?1")
    .bind("hidden-scope").first("trashed_at")).toBeNull();

  for (const directoryId of ["hidden-scope", "detached-scope", "missing-scope"]) {
    expect(await repository.search({ q: "needle", kind: "all", directoryId }, 0, 10)).toEqual([]);
  }

  await database.prepare("UPDATE filesystem_entries SET trashed_at = NULL WHERE id = ?1")
    .bind("trashed-parent").run();
  expect((await repository.search({ q: "needle", kind: "all", directoryId: "hidden-scope" }, 0, 10))
    .map(({ entry }) => entry.id)).toEqual(["hidden-match"]);
});

function directory(id: string, parentId: string | null, name: string): D1PreparedStatement {
  return database.prepare(`
    INSERT INTO filesystem_entries (id, parent_id, kind, name, name_key, created_at, updated_at)
    VALUES (?1, ?2, 'directory', ?3, ?4, 0, 0)`)
    .bind(id, parentId, name, filesystemNameKey(name));
}
