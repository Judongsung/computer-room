import {
  MEDIA_CONTENT_TYPES,
  MEDIA_KIND,
  MEDIA_TYPE_PREFIX,
} from "@/constants/filesystem/media";
import type { MediaKind } from "@/types/filesystem/media";

export function mediaKindFromContentType(
  contentType: string,
): MediaKind | null {
  const baseType = mediaContentTypeBase(contentType);
  if ((MEDIA_CONTENT_TYPES[MEDIA_KIND.IMAGE] as readonly string[]).includes(baseType)) {
    return MEDIA_KIND.IMAGE;
  }
  if ((MEDIA_CONTENT_TYPES[MEDIA_KIND.VIDEO] as readonly string[]).includes(baseType)) {
    return MEDIA_KIND.VIDEO;
  }
  return null;
}

export function isPotentialMediaContentType(contentType: string): boolean {
  const baseType = mediaContentTypeBase(contentType);
  return (
    baseType.startsWith(MEDIA_TYPE_PREFIX.IMAGE) ||
    baseType.startsWith(MEDIA_TYPE_PREFIX.VIDEO)
  );
}

export function mediaContentTypeBase(contentType: string): string {
  return contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}
