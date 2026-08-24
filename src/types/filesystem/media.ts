import type { BYTE_RANGE_KIND, MEDIA_KIND } from "@/constants/filesystem/media";

export type MediaKind =
  (typeof MEDIA_KIND)[keyof typeof MEDIA_KIND];

export type RequestedByteRange =
  | {
      readonly kind: typeof BYTE_RANGE_KIND.CLOSED;
      readonly start: number;
      readonly end: number;
    }
  | { readonly kind: typeof BYTE_RANGE_KIND.OPEN; readonly start: number }
  | { readonly kind: typeof BYTE_RANGE_KIND.SUFFIX; readonly length: number }
  | { readonly kind: typeof BYTE_RANGE_KIND.INVALID };

export interface ByteRange {
  readonly offset: number;
  readonly length: number;
}
