import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { D1MemoRepository } from "@/infrastructure/widgets/d1-memo-repository";
import { D1ChecklistRepository } from "@/infrastructure/widgets/d1-checklist-repository";
import { D1GuestPublicationRepository } from "@/infrastructure/guest/d1-guest-publication-repository";

const date = "2026-09-08";

describe("D1 scoped program reads", () => {
  it("does not prepare queries for empty ID lists", async () => {
    const { database, calls } = observe(env.DB);
    expect(await new D1MemoRepository(database).listByWidgetIds([])).toEqual([]);
    const checklists = new D1ChecklistRepository(database);
    expect(await checklists.listActiveItemsByWidgetIds([], date)).toEqual([]);
    expect(await checklists.listRepeatSettings([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it.each([1, 99, 100, 199])("returns only %i requested programs using bounded queries", async count => {
    const ids = await seed(count + 1);
    try {
      const requested = ids.slice(0, count);
      const input = [...requested, requested[0]!];
      const { database, calls } = observe(env.DB);
      const memos = await new D1MemoRepository(database).listByWidgetIds(input);
      const checklist = new D1ChecklistRepository(database);
      const items = await checklist.listActiveItemsByWidgetIds(input, date);
      const repeats = await checklist.listRepeatSettings(input);
      for (const records of [memos, items, repeats]) {
        expect(records).toHaveLength(count);
        expect(new Set(records.map(row => row.widgetId))).toEqual(new Set(requested));
      }
      expect(calls).toHaveLength(3 * Math.ceil(count / 99));
      for (const call of calls) {
        expect(call.values.length).toBeLessThanOrEqual(100);
        expect(call.sql).toContain(" IN (");
        expect(call.values).not.toContain(ids[count]);
      }
      expect(items.every(item => item.checked === false && item.checkedAt === null)).toBe(true);
    } finally { await remove(ids); }
  });

  it("keeps item order, archived exclusion and active period/version state", async () => {
    const [id, unrelated] = await seed(2);
    try {
      const db = env.DB;
      await db.batch([
        db.prepare("UPDATE checklist_items SET sort_order = 3 WHERE widget_id = ?1").bind(id),
        db.prepare("INSERT INTO checklist_items(id,widget_id,label,sort_order,created_at,updated_at) VALUES (?1,?2,'earlier',0,0,0)").bind(id + "-earlier", id),
        db.prepare("INSERT INTO checklist_items(id,widget_id,label,sort_order,created_at,updated_at,archived_at) VALUES (?1,?2,'archived',1,0,0,1)").bind(id + "-archived", id),
      ]);
      const repo = new D1ChecklistRepository(db);
      const now = Date.parse(date + "T01:00:00Z");
      await repo.setChecked({ widgetId: id!, itemId: id + "-item", itemLabel: "task", checked: true, businessDate: date, occurredAt: now, eventId: crypto.randomUUID() });
      const rows = await repo.listActiveItemsByWidgetIds([id!, id!], date);
      expect(rows.map(row => row.id)).toEqual([id + "-earlier", id + "-item"]);
      expect(rows[1]).toMatchObject({ checked: true, checkedAt: now });
      expect(await repo.listActiveItems(id!, date)).toEqual(rows);
      expect((await repo.listActiveItemsByWidgetIds([id!], "2026-09-09"))[1]).toMatchObject({ checked: false, checkedAt: null });
      await db.prepare("UPDATE checklist_repeat_settings SET version = version + 1 WHERE widget_id = ?1").bind(id).run();
      expect((await repo.listActiveItemsByWidgetIds([id!], date))[1]).toMatchObject({ checked: false, checkedAt: null });
      await db.prepare("DELETE FROM checklist_repeat_settings WHERE widget_id = ?1").bind(id).run();
      const observed = observe(db);
      const publications = new D1GuestPublicationRepository(observed.database);
      expect(await publications.checklistRepeatCycle(id!)).toBe("daily");
      expect(observed.calls).toHaveLength(1);
      expect(observed.calls[0]!.values).toEqual([id]);
    } finally { await remove([id!, unrelated!]); }
  });
});

async function seed(count: number): Promise<string[]> {
  const ids = Array.from({ length: count }, () => crypto.randomUUID());
  for (const id of ids) {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO dashboard_widgets(id,type,position_x,position_y,width,height,stack_order) VALUES (?1,'daily-checklist',0,0,320,300,0)").bind(id),
      env.DB.prepare("INSERT INTO memo_widgets(widget_id,markdown,updated_at) VALUES (?1,'body',NULL)").bind(id),
      env.DB.prepare("INSERT INTO checklist_items(id,widget_id,label,sort_order,created_at,updated_at) VALUES (?1,?2,'task',0,0,0)").bind(id + "-item", id),
      env.DB.prepare("INSERT INTO checklist_repeat_settings(widget_id,repeat_cycle,version) VALUES (?1,'daily',0)").bind(id),
    ]);
  }
  return ids;
}

async function remove(ids: readonly string[]): Promise<void> {
  for (const id of ids) await env.DB.prepare("DELETE FROM dashboard_widgets WHERE id = ?1").bind(id).run();
}

function observe(db: D1Database) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const database = new Proxy(db, {
    get(target, key) {
      if (key !== "prepare") return Reflect.get(target, key, target);
      return (sql: string) => {
        const statement = target.prepare(sql);
        const call = { sql, values: [] as unknown[] };
        calls.push(call);
        return new Proxy(statement, {
          get(prepared, property) {
            if (property === "bind") return (...values: unknown[]) => { call.values = values; return prepared.bind(...values); };
            const value = Reflect.get(prepared, property, prepared);
            return typeof value === "function" ? value.bind(prepared) : value;
          },
        });
      };
    },
  });
  return { database, calls };
}
