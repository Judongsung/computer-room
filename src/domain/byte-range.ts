import { BYTE_RANGE_KIND } from "../constants/media";
import type { ByteRange, RequestedByteRange } from "../types/media";
import { FileRangeNotSatisfiableError } from "./file-content-error";

export function normalizeByteRange(
  request: RequestedByteRange,
  totalSize: number,
): ByteRange {
  if (request.kind === BYTE_RANGE_KIND.INVALID || totalSize <= 0) {
    throw new FileRangeNotSatisfiableError(totalSize);
  }

  if (request.kind === BYTE_RANGE_KIND.SUFFIX) {
    if (request.length <= 0) {
      throw new FileRangeNotSatisfiableError(totalSize);
    }
    const length = Math.min(request.length, totalSize);
    return { offset: totalSize - length, length };
  }

  if (request.start < 0 || request.start >= totalSize) {
    throw new FileRangeNotSatisfiableError(totalSize);
  }

  if (request.kind === BYTE_RANGE_KIND.OPEN) {
    return { offset: request.start, length: totalSize - request.start };
  }

  if (request.end < request.start) {
    throw new FileRangeNotSatisfiableError(totalSize);
  }
  const end = Math.min(request.end, totalSize - 1);
  return { offset: request.start, length: end - request.start + 1 };
}
