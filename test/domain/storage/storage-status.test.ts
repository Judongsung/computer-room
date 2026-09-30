import { describe, expect, it } from "vitest";
import { STORAGE_MIME_CATEGORY, STORAGE_OBJECT_PURPOSE } from "@/constants/storage/storage-status";
import { storageMimeCategory, storageObjectPurpose } from "@/domain/storage/storage-status";

describe("storage status domain", () => {
  it.each([
    [" IMAGE/PNG ; charset=binary ", STORAGE_MIME_CATEGORY.IMAGE],
    ["video/mp4", STORAGE_MIME_CATEGORY.VIDEO],
    ["audio/mpeg", STORAGE_MIME_CATEGORY.AUDIO],
    ["text/plain", STORAGE_MIME_CATEGORY.DOCUMENT],
    ["application/pdf", STORAGE_MIME_CATEGORY.DOCUMENT],
    ["application/zip", STORAGE_MIME_CATEGORY.ARCHIVE],
    ["application/octet-stream", STORAGE_MIME_CATEGORY.OTHER],
    [undefined, STORAGE_MIME_CATEGORY.OTHER],
  ])("classifies normalized MIME %s as %s", (contentType, expected) => {
    expect(storageMimeCategory(contentType)).toBe(expected);
  });

  it("classifies object purposes by ordered prefix with an other fallback", () => {
    expect(storageObjectPurpose("files/source.png")).toBe(
      STORAGE_OBJECT_PURPOSE.ORIGINAL,
    );
    expect(storageObjectPurpose("thumbnails/source.webp")).toBe(
      STORAGE_OBJECT_PURPOSE.THUMBNAIL,
    );
    expect(storageObjectPurpose("unmanaged/source.bin")).toBe(
      STORAGE_OBJECT_PURPOSE.OTHER,
    );
  });
});
