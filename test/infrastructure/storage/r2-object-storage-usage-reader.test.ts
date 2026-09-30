import { describe, expect, it, vi } from "vitest";
import { R2_STORAGE_CLASS, STORAGE_MIME_CATEGORY, STORAGE_OBJECT_PURPOSE } from "@/constants/storage/storage-status";
import { STORAGE_STATUS_ERRORS } from "@/constants/storage/errors/storage-status";
import { R2ObjectStorageUsageReader } from "@/infrastructure/storage/r2-object-storage-usage-reader";

describe("R2ObjectStorageUsageReader", () => {
  it("follows the truncated cursor beyond 1,000 objects and aggregates metadata", async () => {
    const firstPageObjects = Array.from({ length: 1_000 }, (_, index) => ({
      key: index === 999 ? "unmanaged/no-metadata" : `files/image-${index}`,
      size: 1,
      storageClass: R2_STORAGE_CLASS.STANDARD,
      ...(index === 999
        ? {}
        : { httpMetadata: { contentType: "image/png; charset=binary" } }),
    }));
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        objects: firstPageObjects,
        truncated: true,
        cursor: "next-page",
      })
      .mockResolvedValueOnce({
        objects: [
          {
            key: "thumbnails/video.webp",
            size: 25,
            storageClass: "InfrequentAccess",
            httpMetadata: { contentType: "video/mp4" },
          },
        ],
        truncated: false,
      });
    const reader = new R2ObjectStorageUsageReader({ list });

    const usage = await reader.readUsage();

    expect(list).toHaveBeenNthCalledWith(1, {
      limit: 1_000,
      include: ["httpMetadata"],
    });
    expect(list).toHaveBeenNthCalledWith(2, {
      limit: 1_000,
      include: ["httpMetadata"],
      cursor: "next-page",
    });
    expect(usage.total).toEqual({ bytes: 1_025, objectCount: 1_001 });
    expect(usage.standard).toEqual({ bytes: 1_000, objectCount: 1_000 });
    expect(usage.byPurpose.original).toEqual({ bytes: 999, objectCount: 999 });
    expect(usage.byPurpose.thumbnail).toEqual({ bytes: 25, objectCount: 1 });
    expect(usage.byPurpose.other).toEqual({ bytes: 1, objectCount: 1 });
    expect(usage.byMimeCategory.image).toEqual({ bytes: 999, objectCount: 999 });
    expect(usage.byMimeCategory.video).toEqual({ bytes: 25, objectCount: 1 });
    expect(usage.byMimeCategory.other).toEqual({ bytes: 1, objectCount: 1 });
  });

  it("rejects invalid object sizes", async () => {
    const reader = new R2ObjectStorageUsageReader({
      list: async () => ({
        objects: [
          { key: "files/bad", size: -1, storageClass: R2_STORAGE_CLASS.STANDARD },
        ],
        truncated: false,
      }),
    });
    await expect(reader.readUsage()).rejects.toMatchObject({
      code: STORAGE_STATUS_ERRORS.INVALID_USAGE.code,
    });
  });
});
