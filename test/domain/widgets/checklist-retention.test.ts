import { describe, expect, it } from "vitest";
import { checklistRetentionCutoff, isChecklistRetentionDays } from "@/domain/widgets/checklist-retention";

describe("checklist retention policy", () => {
  it.each([null, 1, 30, 3650])("accepts %s", (value) => {
    expect(isChecklistRetentionDays(value)).toBe(true);
  });
  it.each([undefined, "30", true, 0, -1, 1.5, 3651, NaN, Infinity])("rejects %s", (value) => {
    expect(isChecklistRetentionDays(value)).toBe(false);
  });
  it("uses Korean day boundaries across month and leap-day transitions", () => {
    expect(checklistRetentionCutoff(Date.parse("2024-03-01T23:59:59+09:00"), 1))
      .toEqual({ businessDate: "2024-02-29", timestamp: Date.parse("2024-02-29T00:00:00+09:00") });
    expect(checklistRetentionCutoff(Date.parse("2024-03-02T00:00:00+09:00"), 1).businessDate)
      .toBe("2024-03-01");
  });
});
