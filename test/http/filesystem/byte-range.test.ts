import { describe, expect, it } from "vitest";
import { BYTE_RANGE_KIND } from "@/constants/filesystem/media";
import { parseRangeHeader } from "@/http/filesystem/byte-range";

describe("HTTP byte range", () => {
  it("rejects byte positions outside JavaScript's safe integer range", () => {
    expect(parseRangeHeader("bytes=9007199254740992-")).toEqual({
      kind: BYTE_RANGE_KIND.INVALID,
    });
  });
});
