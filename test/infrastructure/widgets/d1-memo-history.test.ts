import { env } from "cloudflare:test";
import { beforeEach, expect, it } from "vitest";
import { MAX_MEMO_VERSIONS } from "@/constants/widgets/memo";
import { D1MemoRepository } from "@/infrastructure/widgets/d1-memo-repository";
import { registerWorkerDatabaseSetup } from "@test/support/platform/worker-database";

registerWorkerDatabaseSetup();

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM dashboard_widgets").run();
});

async function createMemoWidget(): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO dashboard_widgets (id, type, position_x, position_y, width, height, stack_order) VALUES (?1, 'memo', 0, 0, 320, 300, 0)",
  ).bind(id).run();
  return id;
}

it("records changed content and preserves the original timestamp for same-content saves", async () => {
  const widgetId = await createMemoWidget();
  const repository = new D1MemoRepository(env.DB);
  await expect(repository.saveWithVersion({ widgetId, markdown: "", updatedAt: null }))
    .resolves.toEqual({ widgetId, markdown: "", updatedAt: null });
  await expect(repository.saveWithVersion({ widgetId, markdown: "", updatedAt: 200 }))
    .resolves.toEqual({ widgetId, markdown: "", updatedAt: null });
  await expect(repository.saveWithVersion({ widgetId, markdown: "second", updatedAt: 300 }))
    .resolves.toEqual({ widgetId, markdown: "second", updatedAt: 300 });
  expect(await repository.listVersions(widgetId)).toEqual([
    { version: 2, savedAt: 300 },
    { version: 1, savedAt: null },
  ]);
  expect(await repository.findVersion(widgetId, 1)).toEqual({ version: 1, markdown: "", savedAt: null });
});

it("retains the newest fifty versions with monotonic numbers", async () => {
  const widgetId = await createMemoWidget();
  const repository = new D1MemoRepository(env.DB);
  for (let version = 1; version <= MAX_MEMO_VERSIONS + 3; version += 1) {
    await repository.saveWithVersion({ widgetId, markdown: `content ${version}`, updatedAt: version });
  }
  const versions = await repository.listVersions(widgetId);
  expect(versions).toHaveLength(MAX_MEMO_VERSIONS);
  expect(versions[0]).toEqual({ version: MAX_MEMO_VERSIONS + 3, savedAt: MAX_MEMO_VERSIONS + 3 });
  expect(versions.at(-1)).toEqual({ version: 4, savedAt: 4 });
  expect(await repository.findVersion(widgetId, 3)).toBeNull();
});

it("serializes concurrent saves without dropping distinct committed content", async () => {
  const widgetId = await createMemoWidget();
  const repository = new D1MemoRepository(env.DB);
  const contents = Array.from({ length: 12 }, (_, index) => `concurrent ${index}`);
  await Promise.all(contents.map((markdown, index) =>
    repository.saveWithVersion({ widgetId, markdown, updatedAt: index }),
  ));
  const versions = await repository.listVersions(widgetId);
  expect(versions.map(({ version }) => version)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  const stored = await Promise.all(versions.map(({ version }) => repository.findVersion(widgetId, version)));
  expect(stored.map(record => record?.markdown).sort()).toEqual([...contents].sort());
  const current = (await repository.listByWidgetIds([widgetId]))[0];
  expect(current?.markdown).toBe(stored[0]?.markdown);
});

it("stores one version for concurrent saves of the same content", async () => {
  const widgetId = await createMemoWidget();
  const repository = new D1MemoRepository(env.DB);
  await Promise.all(Array.from({ length: 8 }, (_, index) =>
    repository.saveWithVersion({ widgetId, markdown: "same", updatedAt: index + 1 }),
  ));
  expect(await repository.listVersions(widgetId)).toHaveLength(1);
});

it("rolls back the snapshot when the current memo update fails", async () => {
  const widgetId = await createMemoWidget();
  const repository = new D1MemoRepository(env.DB);
  await repository.saveWithVersion({ widgetId, markdown: "original", updatedAt: 1 });
  await env.DB.prepare(
    "CREATE TRIGGER fail_memo_update BEFORE UPDATE ON memo_widgets BEGIN SELECT RAISE(ABORT, 'forced test failure'); END",
  ).run();
  try {
    await expect(repository.saveWithVersion({ widgetId, markdown: "rejected", updatedAt: 2 })).rejects.toThrow();
    expect(await repository.listVersions(widgetId)).toEqual([{ version: 1, savedAt: 1 }]);
    expect(await repository.listByWidgetIds([widgetId])).toEqual([{ widgetId, markdown: "original", updatedAt: 1 }]);
  } finally {
    await env.DB.prepare("DROP TRIGGER fail_memo_update").run();
  }
});
