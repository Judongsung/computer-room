import { describe, expect, it, vi } from "vitest";
import { ChecklistService } from "@/application/widgets/checklist-service";
import { WidgetLayoutService } from "@/application/widgets/widget-layout-service";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { SequenceIdGenerator } from "@test/support/platform/runtime-fakes";
import { checklistReadFixture } from "@test/support/widgets/checklist-read-fixture";
import { MemoryMemoRepository } from "@test/support/widgets/memory-widget-repositories";

describe("widget scoped reads", () => {
  it("reads only the requested memo and skips checklist data", async () => {
    const { layouts, checklists, widget, clock } = await checklistReadFixture("2026-09-08T01:00:00Z", "2026-09-08");
    layouts.records.push({ ...widget, id: "memo", type: WIDGET_TYPE.MEMO });
    const memos = new MemoryMemoRepository();
    await memos.upsert({ widgetId: "memo", markdown: "requested", updatedAt: null });
    await memos.upsert({ widgetId: "unrelated", markdown: "unrelated", updatedAt: null });
    const read = vi.spyOn(memos, "listByWidgetIds");
    const repeats = vi.spyOn(checklists, "listRepeatSettings");
    const service = new WidgetLayoutService(layouts, memos, checklists, new SequenceIdGenerator([]), clock);
    await expect(service.getWidget("memo")).resolves.toMatchObject({ data: { markdown: "requested" } });
    expect(await read.mock.results[0]!.value).toHaveLength(1);
    expect(repeats).not.toHaveBeenCalled();
  });

  it("does not read repeat settings for an empty layout", async () => {
    const { layouts, checklists, clock } = await checklistReadFixture("2026-09-08T01:00:00Z", "2026-09-08");
    layouts.records = [];
    const repeats = vi.spyOn(checklists, "listRepeatSettings");
    const service = new WidgetLayoutService(layouts, new MemoryMemoRepository(), checklists, new SequenceIdGenerator([]), clock);
    await expect(service.listWidgets()).resolves.toEqual([]);
    expect(repeats).not.toHaveBeenCalled();
  });
  it("batches only matching IDs while preserving layout order and defaults", async () => {
    const { layouts, checklists, widget, clock } = await checklistReadFixture("2026-09-08T01:00:00Z", "2026-09-08");
    const memos = new MemoryMemoRepository();
    layouts.records = [
      { ...widget, id: "memo", type: WIDGET_TYPE.MEMO, stackOrder: 0 },
      { ...widget, stackOrder: 1 },
      { ...widget, id: "empty-checklist", stackOrder: 2 },
      { ...widget, id: "empty-memo", type: WIDGET_TYPE.MEMO, stackOrder: 3 },
    ];
    await memos.upsert({ widgetId: "memo", markdown: "body", updatedAt: 0 });
    for (let n = 0; n < 150; n++) {
      const id = "unrelated-" + n;
      await memos.upsert({ widgetId: id, markdown: "unrelated", updatedAt: null });
      checklists.items.push({ id, widgetId: id, label: id, sortOrder: 0, checked: false });
      checklists.repeatSettings.push({ widgetId: id, repeatCycle: "weekly", version: 0 });
    }
    const memoRead = vi.spyOn(memos, "listByWidgetIds");
    const itemsRead = vi.spyOn(checklists, "listActiveItemsByWidgetIds");
    const repeatRead = vi.spyOn(checklists, "listRepeatSettings");
    const service = new WidgetLayoutService(layouts, memos, checklists, new SequenceIdGenerator([]), clock);
    const result = await service.listWidgets();
    expect(result.map(row => row.id)).toEqual(["memo", widget.id, "empty-checklist", "empty-memo"]);
    expect(memoRead).toHaveBeenCalledExactlyOnceWith(["memo", "empty-memo"]);
    expect(itemsRead).toHaveBeenCalledExactlyOnceWith([widget.id, "empty-checklist"], "2026-09-08");
    expect(repeatRead).toHaveBeenCalledExactlyOnceWith([widget.id, "empty-checklist"]);
    expect(await memoRead.mock.results[0]!.value).toHaveLength(1);
    expect(await itemsRead.mock.results[0]!.value).toHaveLength(1);
    expect(await repeatRead.mock.results[0]!.value).toEqual([]);
    expect(result[0]?.data).toEqual({ markdown: "body", updatedAt: new Date(0).toISOString() });
    expect(result[2]?.data).toMatchObject({ repeatCycle: "daily", items: [] });
    expect(result[3]?.data).toEqual({ markdown: "", updatedAt: null });
  });

  it.each([WIDGET_TYPE.STORAGE_STATUS, WIDGET_TYPE.ADMIN, WIDGET_TYPE.IMAGE_UPLOAD_PROFILES])("skips data reads for %s", async type => {
    const { layouts, checklists, widget, clock } = await checklistReadFixture("2026-09-08T01:00:00Z", "2026-09-08");
    layouts.records = [{ ...widget, type }];
    const memos = new MemoryMemoRepository();
    const memoRead = vi.spyOn(memos, "listByWidgetIds");
    const itemsRead = vi.spyOn(checklists, "listActiveItemsByWidgetIds");
    const repeatRead = vi.spyOn(checklists, "listRepeatSettings");
    const service = new WidgetLayoutService(layouts, memos, checklists, new SequenceIdGenerator([]), clock);
    await expect(service.getWidget(widget.id)).resolves.toMatchObject({ type, data: null });
    expect(memoRead).not.toHaveBeenCalled(); expect(itemsRead).not.toHaveBeenCalled(); expect(repeatRead).not.toHaveBeenCalled();
  });

  it("limits a single checklist's settings and rejects missing programs before reading", async () => {
    const { layouts, checklists, widget, clock } = await checklistReadFixture("2026-09-08T01:00:00Z", "2026-09-08");
    const repeats = vi.spyOn(checklists, "listRepeatSettings");
    const items = vi.spyOn(checklists, "listActiveItems");
    const service = new ChecklistService(layouts, checklists, new SequenceIdGenerator([]), clock);
    await service.getChecklist(widget.id);
    expect(repeats).toHaveBeenCalledExactlyOnceWith([widget.id]);
    repeats.mockClear(); items.mockClear();
    await expect(service.getChecklist("missing")).rejects.toThrow();
    expect(repeats).not.toHaveBeenCalled(); expect(items).not.toHaveBeenCalled();
  });

});
