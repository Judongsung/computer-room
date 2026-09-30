import { describe, expect, it } from "vitest";
import { StorageStatusService } from "@/application/storage/storage-status-service";
import { STORAGE_STATUS_ERRORS } from "@/constants/storage/errors/storage-status";
import type { DatabaseStorageUsage, ObjectStorageUsage } from "@/types/storage/storage-status";
import { StaticClock } from "@test/support/platform/runtime-fakes";

const NOW = Date.parse("2026-08-23T12:34:56.789Z");

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
