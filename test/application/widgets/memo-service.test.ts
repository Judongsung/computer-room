import { expect, it } from "vitest";
import { MemoService } from "@/application/widgets/memo-service";
import { MEMO_ERRORS } from "@/constants/widgets/errors/memo";
import { WIDGET_TYPE, WIDGET_WINDOW_POLICY, WINDOW_RESTORE_STATE, WINDOW_STATE } from "@/constants/widgets/widget";
import { isMemoVersion, isMemoVersionList } from "@/domain/widgets/widget-contract";
import { StaticClock } from "@test/support/platform/runtime-fakes";
import { MemoryMemoRepository, MemoryWidgetLayoutRepository } from "@test/support/widgets/memory-widget-repositories";

it("returns stored timestamps for unchanged saves and maps nullable history", async () => {
  const layouts = new MemoryWidgetLayoutRepository();
  const widgetId = "memo";
  const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];
  layouts.records.push({
    id: widgetId,
    type: WIDGET_TYPE.MEMO,
    position: { x: 0, y: 0 },
    size: { width: policy.DEFAULT_WIDTH, height: policy.DEFAULT_HEIGHT },
    windowState: WINDOW_STATE.NORMAL,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
    stackOrder: 0,
    isOpen: true,
    file: null,
  });
  const memos = new MemoryMemoRepository();
  await memos.saveWithVersion({ widgetId, markdown: "original", updatedAt: null });
  const clock = new StaticClock(123);
  const service = new MemoService(layouts, memos, clock);
  expect(await service.updateMemo(widgetId, { markdown: "original" }))
    .toEqual({ markdown: "original", updatedAt: null });
  expect(await service.listMemoVersions(widgetId)).toEqual({ items: [{ version: 1, savedAt: null }] });
  expect(await service.getMemoVersion(widgetId, 1)).toEqual({ version: 1, markdown: "original", savedAt: null });
  clock.timestamp = 456;
  expect(await service.updateMemo(widgetId, { markdown: "next" }))
    .toEqual({ markdown: "next", updatedAt: new Date(456).toISOString() });
  const list = await service.listMemoVersions(widgetId);
  expect(list.items.map(item => item.version)).toEqual([2, 1]);
  expect(isMemoVersionList(list)).toBe(true);
  expect(isMemoVersion(await service.getMemoVersion(widgetId, 2))).toBe(true);
  await expect(service.getMemoVersion(widgetId, 0)).rejects.toMatchObject({ code: MEMO_ERRORS.INVALID_VERSION.code });
  await expect(service.getMemoVersion(widgetId, 3)).rejects.toMatchObject({ code: MEMO_ERRORS.VERSION_NOT_FOUND.code });
});
