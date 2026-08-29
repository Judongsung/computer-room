import {
  MEDIA_CONTENT_TYPES,
  MEDIA_KIND_VALUES,
  MEDIA_TYPE_PREFIX_BY_KIND,
} from "@/constants/filesystem/media";
import type { MediaKind } from "@/types/filesystem/media";

export function mediaKindFromContentType(
  contentType: string,
): MediaKind | null {
  const baseType = mediaContentTypeBase(contentType);
  return (
    MEDIA_KIND_VALUES.find((kind) =>
      (MEDIA_CONTENT_TYPES[kind] as readonly string[]).includes(baseType),
    ) ?? null
  );
}

export function isPotentialMediaContentType(contentType: string): boolean {
  const baseType = mediaContentTypeBase(contentType);
  return MEDIA_KIND_VALUES.some((kind) =>
    baseType.startsWith(MEDIA_TYPE_PREFIX_BY_KIND[kind]),
  );
}

export function mediaContentTypeBase(contentType: string): string {
  return contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}
