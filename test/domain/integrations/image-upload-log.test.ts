import { describe, expect, it } from "vitest";
import {
  decodeImageUploadLogCursor,
  encodeImageUploadLogCursor,
  imageUploadLogRetentionCutoff,
} from "@/domain/integrations/image-upload-log";

describe("image upload log policy", () => {
  it("uses the Korean midnight 30-day retention boundary", () => {
    const reference = Date.parse("2026-08-30T15:00:00.000Z");
    expect(imageUploadLogRetentionCutoff(reference)).toBe(
      Date.parse("2026-07-31T15:00:00.000Z"),
    );
    expect(imageUploadLogRetentionCutoff(reference + 12 * 60 * 60 * 1_000)).toBe(
      Date.parse("2026-07-31T15:00:00.000Z"),
    );
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
