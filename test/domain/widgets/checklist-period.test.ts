import { describe, expect, it } from "vitest";
import { checklistPeriod } from "@/domain/widgets/checklist-period";

describe("checklistPeriod", () => {
  it.each([
    ["daily", "2026-09-06T14:59:59Z", "2026-09-06", "2026-09-06T15:00:00Z"],
    ["daily", "2026-09-06T15:00:00Z", "2026-09-07", "2026-09-07T15:00:00Z"],
    ["weekly", "2026-09-06T14:59:59Z", "2026-08-31", "2026-09-06T15:00:00Z"],
    ["weekly", "2026-09-06T15:00:00Z", "2026-09-07", "2026-09-13T15:00:00Z"],
    ["monthly", "2028-02-29T12:00:00Z", "2028-02-01", "2028-02-29T15:00:00Z"],
    ["monthly", "2026-12-31T14:59:59Z", "2026-12-01", "2026-12-31T15:00:00Z"],
  ] as const)("%s boundary at %s", (cycle, now, start, end) => {
    expect(checklistPeriod(Date.parse(now), cycle)).toEqual({ start, end: Date.parse(end) });
  });
});
