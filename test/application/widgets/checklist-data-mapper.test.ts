import { describe, expect, it } from "vitest";
import { toChecklistData, toChecklistItem } from "@/application/widgets/checklist-data-mapper";
import type { ChecklistItemRecord } from "@/types/widgets/checklist";

describe("checklist response mapping", () => {
  it.each([
    ["daily", "2026-09-06T14:59:59.000Z", "2026-09-06", "2026-09-06T15:00:00.000Z"],
    ["daily", "2026-09-06T15:00:00.000Z", "2026-09-07", "2026-09-07T15:00:00.000Z"],
    ["weekly", "2026-09-06T14:59:59.000Z", "2026-09-06", "2026-09-06T15:00:00.000Z"],
    ["weekly", "2026-09-06T15:00:00.000Z", "2026-09-07", "2026-09-13T15:00:00.000Z"],
    ["monthly", "2026-09-30T14:59:59.000Z", "2026-09-30", "2026-09-30T15:00:00.000Z"],
    ["monthly", "2026-09-30T15:00:00.000Z", "2026-10-01", "2026-10-31T15:00:00.000Z"],
  ] as const)("maps an empty %s checklist at %s", (repeatCycle, now, businessDate, nextResetAt) => {
    expect(toChecklistData(Date.parse(now), repeatCycle, [])).toEqual({
      businessDate, repeatCycle, nextResetAt, items: [],
    });
  });

  it("preserves item order and ISO check times without exposing storage fields", () => {
    const items: readonly ChecklistItemRecord[] = [
      { id: "second", widgetId: "widget", label: "두 번째", sortOrder: 1, checked: true, checkedAt: 0 },
      { id: "first", widgetId: "widget", label: "첫 번째", sortOrder: 0, checked: false, checkedAt: null },
    ];
    const original = structuredClone(items);
    expect(toChecklistData(Date.parse("2026-09-07T00:00:00.000Z"), "daily", items).items).toEqual([
      { id: "second", label: "두 번째", checked: true, checkedAt: "1970-01-01T00:00:00.000Z" },
      { id: "first", label: "첫 번째", checked: false, checkedAt: null },
    ]);
    expect(items).toEqual(original);
  });

  it("normalizes a missing check time to null", () => {
    expect(toChecklistItem({ id: "item", widgetId: "widget", label: "기존 항목", sortOrder: 0, checked: false })).toEqual({
      id: "item", label: "기존 항목", checked: false, checkedAt: null,
    });
  });
});
