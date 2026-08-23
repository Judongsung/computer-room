import {
  THUMBNAIL_OBJECT_KEY_PREFIX,
  THUMBNAIL_SOURCE_CONTENT_TYPES,
  THUMBNAIL_SPEC,
  THUMBNAIL_VERSION_VALUES,
} from "../constants/thumbnail";
import { mediaContentTypeBase } from "./media-type";

export function isThumbnailSourceSupported(
  contentType: string,
  size: number,
): boolean {
  return (
    size >= 0 &&
    size <= THUMBNAIL_SPEC.MAX_SOURCE_SIZE_BYTES &&
    THUMBNAIL_SOURCE_CONTENT_TYPES.some(
      (supportedType) =>
        supportedType === mediaContentTypeBase(contentType),
    )
  );
}

export function thumbnailObjectKey(
  fileId: string,
  version = THUMBNAIL_SPEC.CURRENT_VERSION,
): string {
  return `${THUMBNAIL_OBJECT_KEY_PREFIX}/${version}/${fileId}.webp`;
}

export function thumbnailObjectKeys(fileId: string): string[] {
  return THUMBNAIL_VERSION_VALUES.map((version) =>
    thumbnailObjectKey(fileId, version),
  );
}
