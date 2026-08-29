import { describe, expect, it } from "vitest";
import { FILE_ERRORS } from "@/constants/filesystem/errors/file";
import {
  BYTE_RANGE_KIND,
  MEDIA_CONTENT_TYPES,
  MEDIA_KIND,
  MEDIA_KIND_VALUES,
} from "@/constants/filesystem/media";
import { normalizeByteRange } from "@/domain/filesystem/byte-range";
import {
  isPotentialMediaContentType,
  mediaKindFromContentType,
} from "@/domain/filesystem/media-type";
import { parseRangeHeader } from "@/http/filesystem/byte-range";

describe("media type", () => {
  it("classifies only supported image and video media types", () => {
    for (const kind of MEDIA_KIND_VALUES) {
      for (const contentType of MEDIA_CONTENT_TYPES[kind]) {
        expect(mediaKindFromContentType(contentType.toUpperCase())).toBe(kind);
      }
    }
    expect(mediaKindFromContentType("IMAGE/PNG; charset=binary")).toBe(MEDIA_KIND.IMAGE);
    expect(mediaKindFromContentType("image/svg+xml")).toBeNull();
    expect(isPotentialMediaContentType("video/x-matroska")).toBe(true);
    expect(isPotentialMediaContentType("application/pdf")).toBe(false);
  });
});

describe("byte range", () => {
  it("normalizes closed, open, and suffix ranges", () => {
    expect(normalizeByteRange({ kind: BYTE_RANGE_KIND.CLOSED, start: 2, end: 5 }, 10)).toEqual({
      offset: 2,
      length: 4,
    });
    expect(normalizeByteRange({ kind: BYTE_RANGE_KIND.OPEN, start: 7 }, 10)).toEqual({
      offset: 7,
      length: 3,
    });
    expect(normalizeByteRange({ kind: BYTE_RANGE_KIND.SUFFIX, length: 3 }, 10)).toEqual({
      offset: 7,
      length: 3,
    });
  });

  it("clamps an end or suffix beyond the file size", () => {
    expect(normalizeByteRange({ kind: BYTE_RANGE_KIND.CLOSED, start: 7, end: 30 }, 10)).toEqual({
      offset: 7,
      length: 3,
    });
    expect(normalizeByteRange({ kind: BYTE_RANGE_KIND.SUFFIX, length: 30 }, 10)).toEqual({
      offset: 0,
      length: 10,
    });
  });

  it.each([
    { kind: BYTE_RANGE_KIND.INVALID } as const,
    { kind: BYTE_RANGE_KIND.CLOSED, start: 8, end: 7 } as const,
    { kind: BYTE_RANGE_KIND.OPEN, start: 10 } as const,
    { kind: BYTE_RANGE_KIND.SUFFIX, length: 0 } as const,
  ])("rejects an unsatisfiable range", (range) => {
    expect(() => normalizeByteRange(range, 10)).toThrowError(
      expect.objectContaining({ code: FILE_ERRORS.RANGE_NOT_SATISFIABLE.code }),
    );
  });

  it("rejects byte positions outside JavaScript's safe integer range", () => {
    expect(parseRangeHeader("bytes=9007199254740992-")).toEqual({
      kind: BYTE_RANGE_KIND.INVALID,
    });
  });
});
