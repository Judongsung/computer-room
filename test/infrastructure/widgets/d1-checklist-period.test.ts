import { env } from "cloudflare:test";
import { expect, it } from "vitest";
import { D1ChecklistRepository } from "@/infrastructure/widgets/d1-checklist-repository";
import { D1ChecklistRetentionRepository } from "@/infrastructure/widgets/d1-checklist-retention-repository";

it("preserves checks across cycle changes without resurrecting old versions", async () => {
  const widgetId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const db = env.DB;
  await db.prepare(`INSERT INTO dashboard_widgets(id,type,position_x,position_y,width,height,stack_order)
    VALUES (?1,'daily-checklist',0,0,320,300,0)`).bind(widgetId).run();
  const repo = new D1ChecklistRepository(db);
  const now = Date.parse("2026-09-08T04:35:00Z");
  await repo.insertItem({ id: itemId, widgetId, label: "task", createdAt: now, businessDate: "2026-09-08", eventId: crypto.randomUUID() });
  const check = (checked: boolean, occurredAt = now) => repo.setChecked({widgetId,itemId,itemLabel:"task",checked,
    occurredAt,businessDate:"2026-09-08",eventId:crypto.randomUUID()});
  await check(true);
  await check(true, now + 1000);
  expect((await repo.listActiveItems(widgetId,"2026-09-08"))[0]).toMatchObject({checked:true,checkedAt:now});
  expect((await repo.listActiveItems(widgetId,"2026-09-09"))[0]).toMatchObject({checked:false,checkedAt:null});
  await repo.changeRepeatCycle(widgetId,"weekly",now);
  expect((await repo.listActiveItems(widgetId,"2026-09-13"))[0]).toMatchObject({checked:true,checkedAt:now});
  expect((await repo.listActiveItems(widgetId,"2026-09-14"))[0]?.checked).toBe(false);
  await check(false);
  await repo.changeRepeatCycle(widgetId,"daily",now);
  expect((await repo.listActiveItems(widgetId,"2026-09-08"))[0]?.checked).toBe(false);
  await repo.changeRepeatCycle(widgetId,"monthly",now);
  await check(true,now+2000);
  await new D1ChecklistRetentionRepository(db).purgeBefore("2026-09-20",Date.parse("2026-09-19T15:00:00Z"));
  expect((await repo.listActiveItems(widgetId,"2026-09-25"))[0]).toMatchObject({checked:true,checkedAt:now+2000});
  expect((await repo.listActiveItems(widgetId,"2026-10-01"))[0]?.checked).toBe(false);
  const before = await repo.listRepeatSettings();
  await repo.changeRepeatCycle(widgetId,"monthly",now);
  expect(await repo.listRepeatSettings()).toEqual(before);
  await Promise.all([repo.changeRepeatCycle(widgetId,"weekly",now),check(false)]);
  expect((await repo.listActiveItems(widgetId,"2026-09-08"))[0]?.checked).toBe(false);
  await db.prepare("DELETE FROM dashboard_widgets WHERE id = ?1").bind(widgetId).run();
});
