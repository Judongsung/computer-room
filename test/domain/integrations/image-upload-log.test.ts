import { describe, expect, it } from "vitest";
import {
  decodeImageUploadLogCursor,
  encodeImageUploadLogCursor,
  imageUploadLogRetentionCutoff,
  imageUploadLogSourceIp,
  isImageUploadLogRetentionDays,
} from "@/domain/integrations/image-upload-log";

describe("image upload log policy", () => {
  it("uses the Korean midnight 30-day retention boundary", () => {
    const reference = Date.parse("2026-08-30T15:00:00.000Z");
    expect(imageUploadLogRetentionCutoff(reference, 30)).toBe(
      Date.parse("2026-07-31T15:00:00.000Z"),
    );
    expect(
      imageUploadLogRetentionCutoff(
        reference + 12 * 60 * 60 * 1_000,
        30,
      ),
    ).toBe(Date.parse("2026-07-31T15:00:00.000Z"));
    expect(imageUploadLogRetentionCutoff(reference, 1)).toBe(
      Date.parse("2026-08-29T15:00:00.000Z"),
    );
  });

  it("validates configurable retention days", () => {
    expect(isImageUploadLogRetentionDays(1)).toBe(true);
    expect(isImageUploadLogRetentionDays(30)).toBe(true);
    expect(isImageUploadLogRetentionDays(365)).toBe(true);
    expect(isImageUploadLogRetentionDays(0)).toBe(false);
    expect(isImageUploadLogRetentionDays(1.5)).toBe(false);
    expect(isImageUploadLogRetentionDays(366)).toBe(false);
  });

  it("accepts IPv4 and IPv6 addresses and ignores malformed values", () => {
    expect(imageUploadLogSourceIp(" 203.0.113.8 ")).toBe("203.0.113.8");
    expect(imageUploadLogSourceIp("2001:db8::8")).toBe("2001:db8::8");
    expect(imageUploadLogSourceIp(null)).toBeNull();
    expect(imageUploadLogSourceIp("203.0.113.999")).toBeNull();
    expect(imageUploadLogSourceIp("203.0.113.8, 198.51.100.1")).toBeNull();
  });

  it("round-trips valid cursors and rejects malformed values", () => {
    const cursor = { receivedAt: 1_777_777_777_777, id: "log-id" };
    expect(decodeImageUploadLogCursor(encodeImageUploadLogCursor(cursor))).toEqual(
      cursor,
    );
    expect(decodeImageUploadLogCursor("invalid")).toBeNull();
    expect(decodeImageUploadLogCursor("100.bad/id")).toBeNull();
  });
});
