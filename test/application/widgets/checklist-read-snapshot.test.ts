import { describe, expect, it, vi } from "vitest";
import { ChecklistService } from "@/application/widgets/checklist-service";
import { WidgetLayoutService } from "@/application/widgets/widget-layout-service";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { SequenceIdGenerator } from "@test/support/platform/runtime-fakes";
import { CHECKLIST_READ_BOUNDARIES, checklistReadFixture } from "@test/support/widgets/checklist-read-fixture";
import { MemoryMemoRepository } from "@test/support/widgets/memory-widget-repositories";

describe("checklist read snapshots", () => {
  it.each(CHECKLIST_READ_BOUNDARIES)("keeps the $cycle period when a single read crosses its boundary", async ({ cycle, before, boundary, businessDate }) => {
    const { clock, layouts, checklists, widget, publicItem } = await checklistReadFixture(before, businessDate, cycle);
    const list = checklists.listActiveItems.bind(checklists);
    const read = vi.spyOn(checklists, "listActiveItems").mockImplementation(async (id, date) => {
      const items = await list(id, date);
      clock.timestamp = Date.parse(boundary);
      return items;
    });
    const service = new ChecklistService(layouts, checklists, new SequenceIdGenerator([]), clock);

    await expect(service.getChecklist(widget.id)).resolves.toEqual({
      repeatCycle: cycle, businessDate, nextResetAt: boundary, items: [publicItem],
    });
    expect(read).toHaveBeenCalledWith(widget.id, businessDate);
  });

  it.each(CHECKLIST_READ_BOUNDARIES)("shares the captured $cycle period across hydrated windows", async ({ cycle, before, boundary, businessDate }) => {
    const { clock, layouts, checklists, widget, publicItem } = await checklistReadFixture(before, businessDate, cycle);
    const second = { ...widget, id: "00000000-0000-4000-8000-000000000102", stackOrder: 1 };
    layouts.records.push(second);
    // The second window has no setting and must keep the daily default.
    const list = checklists.listAllActiveItems.bind(checklists);
    const read = vi.spyOn(checklists, "listAllActiveItems").mockImplementation(async (date) => {
      const items = await list(date);
      clock.timestamp = Date.parse(boundary);
      return items;
    });
    const service = new WidgetLayoutService(layouts, new MemoryMemoRepository(), checklists, new SequenceIdGenerator([]), clock);
    const widgets = await service.listWidgets();

    expect(widgets.map(({ type, data }) => ({ type, data }))).toEqual([
      { type: WIDGET_TYPE.DAILY_CHECKLIST, data: { repeatCycle: cycle, businessDate, nextResetAt: boundary, items: [publicItem] } },
      { type: WIDGET_TYPE.DAILY_CHECKLIST, data: { repeatCycle: "daily", businessDate, nextResetAt: boundary, items: [] } },
    ]);
    expect(read).toHaveBeenCalledWith(businessDate);
  });

  it("keeps the daily default when a single checklist has no repeat setting", async () => {
    const { before, boundary, businessDate } = CHECKLIST_READ_BOUNDARIES[0];
    const { clock, layouts, checklists, widget, publicItem } = await checklistReadFixture(before, businessDate);
    const service = new ChecklistService(layouts, checklists, new SequenceIdGenerator([]), clock);
    await expect(service.getChecklist(widget.id)).resolves.toEqual({
      repeatCycle: "daily", businessDate, nextResetAt: boundary, items: [publicItem],
    });
  });
});
