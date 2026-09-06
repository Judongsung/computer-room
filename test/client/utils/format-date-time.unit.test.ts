import { expect, it } from "vitest";
import { formatKoreaDateTime } from "@client/utils/format-date-time";

it("formats Korea time across date and year boundaries", () => {
  expect(formatKoreaDateTime("2026-09-06T05:35:00Z")).toBe("2026-09-06 14:35");
  expect(formatKoreaDateTime("2026-12-31T15:00:00Z")).toBe("2027-01-01 00:00");
});
