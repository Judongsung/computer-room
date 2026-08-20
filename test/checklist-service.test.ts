import { describe, expect, it } from "vitest";
import { ChecklistService } from "../src/application/checklist-service";
import { CHECKLIST_EVENT_ACTION } from "../src/constants/checklist";
import { WIDGET_SIZE_BY_TYPE, WIDGET_TYPE } from "../src/constants/widget";
import {
  MemoryChecklistRepository,
  MemoryWidgetLayoutRepository,
  SequenceIdGenerator,
  StaticClock,
} from "./fakes";

const WIDGET_ID = "00000000-0000-4000-8000-000000000101";
const ITEM_ID = "00000000-0000-4000-8000-000000000102";
const FIRST_EVENT_ID = "00000000-0000-4000-8000-000000000103";
const DUPLICATE_EVENT_ID = "00000000-0000-4000-8000-000000000104";
const NEXT_DAY_EVENT_ID = "00000000-0000-4000-8000-000000000105";

describe("ChecklistService", () => {
  it("resets state at Korea midnight and records only actual changes", async () => {
    const layouts = new MemoryWidgetLayoutRepository();
    const size = WIDGET_SIZE_BY_TYPE[WIDGET_TYPE.DAILY_CHECKLIST];
    layouts.records = [
      {
        id: WIDGET_ID,
        type: WIDGET_TYPE.DAILY_CHECKLIST,
        position: { column: 0, row: 0 },
        size: {
          columns: size.DEFAULT_COLUMNS,
          rows: size.DEFAULT_ROWS,
        },
      },
    ];
    const repository = new MemoryChecklistRepository();
    const clock = new StaticClock(
      Date.parse("2026-08-20T14:59:59.000Z"),
    );
    const service = new ChecklistService(
      layouts,
      repository,
      new SequenceIdGenerator([
        ITEM_ID,
        FIRST_EVENT_ID,
        DUPLICATE_EVENT_ID,
        NEXT_DAY_EVENT_ID,
      ]),
      clock,
    );

    const item = await service.addItem(WIDGET_ID, { label: "  물 마시기  " });
    expect(item).toEqual({ id: ITEM_ID, label: "물 마시기", checked: false });

    await service.setItemChecked(WIDGET_ID, ITEM_ID, { checked: true });
    await service.setItemChecked(WIDGET_ID, ITEM_ID, { checked: true });
    await expect(service.getChecklist(WIDGET_ID)).resolves.toMatchObject({
      businessDate: "2026-08-20",
      items: [{ ...item, checked: true }],
    });
    expect(repository.events).toHaveLength(1);

    clock.timestamp = Date.parse("2026-08-20T15:00:00.000Z");
    await expect(service.getChecklist(WIDGET_ID)).resolves.toMatchObject({
      businessDate: "2026-08-21",
      items: [{ ...item, checked: false }],
    });

    await service.setItemChecked(WIDGET_ID, ITEM_ID, { checked: true });
    const logs = await service.listLogs(WIDGET_ID, 0, 50);
    expect(logs.items).toEqual([
      expect.objectContaining({
        id: NEXT_DAY_EVENT_ID,
        action: CHECKLIST_EVENT_ACTION.CHECKED,
        businessDate: "2026-08-21",
      }),
      expect.objectContaining({
        id: FIRST_EVENT_ID,
        action: CHECKLIST_EVENT_ACTION.CHECKED,
        businessDate: "2026-08-20",
      }),
    ]);
  });
});
