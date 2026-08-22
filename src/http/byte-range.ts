import { HTTP_RANGE_UNIT } from "../constants/http";
import { BYTE_RANGE_KIND } from "../constants/media";
import type { RequestedByteRange } from "../types/media";

const BYTE_RANGE_PATTERN = new RegExp(
  `^${HTTP_RANGE_UNIT}=(\\d*)-(\\d*)$`,
);

export function parseRangeHeader(value: string | null): RequestedByteRange | undefined {
  if (value === null) {
    return undefined;
  }
  const match = BYTE_RANGE_PATTERN.exec(value.trim());
  if (!match) {
    return { kind: BYTE_RANGE_KIND.INVALID };
  }
  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
  if (!startText && !endText) {
    return { kind: BYTE_RANGE_KIND.INVALID };
  }
  if (!startText) {
    const length = safeBytePosition(endText);
    return length === null
      ? { kind: BYTE_RANGE_KIND.INVALID }
      : { kind: BYTE_RANGE_KIND.SUFFIX, length };
  }
  const start = safeBytePosition(startText);
  if (start === null) {
    return { kind: BYTE_RANGE_KIND.INVALID };
  }
  if (!endText) {
    return { kind: BYTE_RANGE_KIND.OPEN, start };
  }
  const end = safeBytePosition(endText);
  if (end === null) {
    return { kind: BYTE_RANGE_KIND.INVALID };
  }
  return {
    kind: BYTE_RANGE_KIND.CLOSED,
    start,
    end,
  };
}

function safeBytePosition(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
