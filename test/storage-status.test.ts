import { describe, expect, it, vi } from "vitest";
import { StorageStatusService } from "@/application/storage/storage-status-service";
import {
  R2_STORAGE_CLASS,
  STORAGE_MIME_CATEGORY,
  STORAGE_OBJECT_PURPOSE,
} from "@/constants/storage/storage-status";
import { STORAGE_STATUS_ERRORS } from "@/constants/storage/errors/storage-status";
import {
  storageMimeCategory,
  storageObjectPurpose,
} from "@/domain/storage/storage-status";
import { R2ObjectStorageUsageReader } from "@/infrastructure/storage/r2-object-storage-usage-reader";
import type {
  DatabaseStorageUsage,
  ObjectStorageUsage,
} from "@/types/storage/storage-status";
import { StaticClock } from "@test/fakes";

const NOW = Date.parse("2026-08-23T12:34:56.789Z");

describe("storage status domain", () => {
  it("normalizes MIME parameters and classifies object purposes", () => {
    expect(storageMimeCategory(" IMAGE/PNG ; charset=binary ")).toBe(
      STORAGE_MIME_CATEGORY.IMAGE,
    );
    expect(storageMimeCategory("application/zip")).toBe(
      STORAGE_MIME_CATEGORY.ARCHIVE,
    );
    expect(storageMimeCategory(undefined)).toBe(STORAGE_MIME_CATEGORY.OTHER);
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

describe("StorageStatusService", () => {
  it("combines R2 and D1 measurements with the injected clock", async () => {
    const r2 = emptyObjectUsage();
    const d1 = emptyDatabaseUsage();
    const service = new StorageStatusService(
      { readUsage: async () => r2 },
      { readUsage: async () => d1 },
      new StaticClock(NOW),
    );

    await expect(service.getStatus()).resolves.toEqual({
      measuredAt: "2026-08-23T12:34:56.789Z",
      r2,
      d1,
    });
  });

  it("translates adapter failures to a stable service error", async () => {
    const service = new StorageStatusService(
      { readUsage: async () => { throw new Error("private object detail"); } },
      { readUsage: async () => emptyDatabaseUsage() },
      new StaticClock(NOW),
    );
    await expect(service.getStatus()).rejects.toMatchObject({
      code: STORAGE_STATUS_ERRORS.LOAD_FAILED.code,
      message: STORAGE_STATUS_ERRORS.LOAD_FAILED.message,
    });
  });
});

function emptyObjectUsage(): ObjectStorageUsage {
  const empty = () => ({ bytes: 0, objectCount: 0 });
  return {
    total: empty(),
    standard: empty(),
    byPurpose: {
      original: empty(),
      thumbnail: empty(),
      other: empty(),
    },
    byMimeCategory: {
      image: empty(),
      video: empty(),
      audio: empty(),
      document: empty(),
      archive: empty(),
      other: empty(),
    },
  };
}
function emptyDatabaseUsage(): DatabaseStorageUsage {
  return {
    databaseBytes: 0,
    registeredFileCount: 0,
    directoryCount: 0,
    widgetCount: 0,
    trashItemCount: 0,
  };
}
