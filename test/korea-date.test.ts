import { describe, expect, it } from "vitest";
import { getKoreaDateContext } from "../src/domain/korea-date";

describe("Korea business date", () => {
  it("changes at midnight in Asia/Seoul", () => {
    expect(
      getKoreaDateContext(Date.parse("2026-08-20T14:59:59.999Z")),
    ).toEqual({
      businessDate: "2026-08-20",
      nextResetAt: Date.parse("2026-08-20T15:00:00.000Z"),
    });
    expect(
      getKoreaDateContext(Date.parse("2026-08-20T15:00:00.000Z")),
    ).toEqual({
      businessDate: "2026-08-21",
      nextResetAt: Date.parse("2026-08-21T15:00:00.000Z"),
    });
  });
});
