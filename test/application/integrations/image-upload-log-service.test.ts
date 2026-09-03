import { describe, expect, it } from "vitest";
import { ImageUploadLogService } from "@/application/integrations/image-upload-log-service";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { IMAGE_UPLOAD_LOG_OUTCOME } from "@/constants/integrations/image-upload-log";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import type { ActiveFilesystemEntryResolver } from "@/types/filesystem/policies/filesystem-policies";
import type {
  ImageUploadLogRepository,
  ImageUploadLogRepositoryQuery,
  StoredImageUploadLog,
} from "@/types/integrations/image-upload-log";
import { filesystemEntryRecord } from "@test/support/filesystem/filesystem-entry-record";
import {
  SequenceIdGenerator,
  StaticClock,
} from "@test/support/platform/runtime-fakes";

const KOREA_AUGUST_31_MIDNIGHT = Date.parse("2026-08-30T15:00:00.000Z");
const SEVEN_DAY_RETENTION_CUTOFF = Date.parse("2026-08-23T15:00:00.000Z");
const SETTINGS = { getSettings: async () => ({ retentionDays: 30 }) };

describe("ImageUploadLogService", () => {
  it("records safe success and failure details and resolves only active files", async () => {
    const repository = new MemoryImageUploadLogRepository();
    const file = filesystemEntryRecord(
      "file-entry",
      FILESYSTEM_ENTRY_KIND.FILE,
      "saved.png",
      {
        contentType: "image/png",
        size: 42,
        createdAt: KOREA_AUGUST_31_MIDNIGHT,
        updatedAt: KOREA_AUGUST_31_MIDNIGHT,
      },
    );
    const activeEntries = {
      findMany: async (ids: readonly string[]) =>
        ids.includes(file.id) ? [file] : [],
    } as ActiveFilesystemEntryResolver;
    const service = new ImageUploadLogService(
      repository,
      SETTINGS,
      activeEntries,
      new SequenceIdGenerator(["success-log", "failure-log"]),
      new StaticClock(KOREA_AUGUST_31_MIDNIGHT),
    );

    await service.record({
      profileId: "novelai",
      sourceIp: "203.0.113.8",
      contentType: "IMAGE/PNG; charset=binary",
      declaredSize: 42,
      receivedAt: KOREA_AUGUST_31_MIDNIGHT - 1_000,
      durationMs: 17.9,
      outcome: IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS,
      file: {
        id: file.id,
        parentId: file.parentId!,
        kind: FILESYSTEM_ENTRY_KIND.FILE,
        name: file.name,
        contentType: file.contentType!,
        size: file.size!,
        createdAt: new Date(file.createdAt).toISOString(),
        updatedAt: new Date(file.updatedAt).toISOString(),
        desktopOrder: null,
      },
    });
    await service.record({
      profileId: "novelai",
      sourceIp: "2001:db8::8",
      contentType: "text/plain",
      declaredSize: 4,
      receivedAt: KOREA_AUGUST_31_MIDNIGHT,
      durationMs: -1,
      outcome: IMAGE_UPLOAD_LOG_OUTCOME.FAILURE,
      error: HTTP_ERRORS.UNSUPPORTED_MEDIA_TYPE,
    });

    const page = await service.listLogs({});
    expect(page.items).toEqual([
      expect.objectContaining({
        id: "failure-log",
        sourceIp: "2001:db8::8",
        contentType: "text/plain",
        durationMs: 0,
        file: null,
        error: expect.objectContaining({
          code: HTTP_ERRORS.UNSUPPORTED_MEDIA_TYPE.code,
        }),
      }),
      expect.objectContaining({
        id: "success-log",
        sourceIp: "203.0.113.8",
        contentType: "image/png",
        durationMs: 17,
        file: expect.objectContaining({ id: file.id, name: file.name }),
        error: null,
      }),
    ]);

    activeEntries.findMany = async () => [];
    await expect(service.listLogs({})).resolves.toMatchObject({
      items: [expect.anything(), expect.objectContaining({ file: null })],
    });
  });

  it("uses the stored retention period when listing logs", async () => {
    const repository = new MemoryImageUploadLogRepository([
      failureLog("older", SEVEN_DAY_RETENTION_CUTOFF - 1),
      failureLog("boundary", SEVEN_DAY_RETENTION_CUTOFF),
      failureLog("recent", KOREA_AUGUST_31_MIDNIGHT - 1),
    ]);
    const service = new ImageUploadLogService(
      repository,
      { getSettings: async () => ({ retentionDays: 7 }) },
      { findMany: async () => [] } as unknown as ActiveFilesystemEntryResolver,
      new SequenceIdGenerator([]),
      new StaticClock(KOREA_AUGUST_31_MIDNIGHT),
    );

    await expect(service.listLogs({})).resolves.toMatchObject({
      items: [{ id: "recent" }, { id: "boundary" }],
    });
  });
});

class MemoryImageUploadLogRepository implements ImageUploadLogRepository {
  readonly items: StoredImageUploadLog[];

  constructor(items: readonly StoredImageUploadLog[] = []) {
    this.items = [...items];
  }

  async insert(log: StoredImageUploadLog): Promise<void> {
    this.items.push(log);
  }

  async list(query: ImageUploadLogRepositoryQuery): Promise<StoredImageUploadLog[]> {
    return this.items
      .filter((item) => item.receivedAt >= query.cutoff)
      .filter((item) => !query.profileId || item.profileId === query.profileId)
      .filter((item) => !query.outcome || item.outcome === query.outcome)
      .filter(
        (item) =>
          !query.cursor ||
          item.receivedAt < query.cursor.receivedAt ||
          (item.receivedAt === query.cursor.receivedAt &&
            item.id < query.cursor.id),
      )
      .sort(
        (left, right) =>
          right.receivedAt - left.receivedAt || right.id.localeCompare(left.id),
      )
      .slice(0, query.limit);
  }

  async purgeBefore(cutoff: number): Promise<number> {
    const retained = this.items.filter((item) => item.receivedAt >= cutoff);
    const removed = this.items.length - retained.length;
    this.items.splice(0, this.items.length, ...retained);
    return removed;
  }
}

function failureLog(id: string, receivedAt: number): StoredImageUploadLog {
  return {
    id,
    profileId: "novelai",
    sourceIp: null,
    outcome: IMAGE_UPLOAD_LOG_OUTCOME.FAILURE,
    contentType: "image/png",
    declaredSize: 1,
    fileEntryId: null,
    fileName: null,
    httpStatus: HTTP_ERRORS.INTERNAL_ERROR.status,
    errorCode: HTTP_ERRORS.INTERNAL_ERROR.code,
    errorMessage: HTTP_ERRORS.INTERNAL_ERROR.message,
    receivedAt,
    durationMs: 1,
  };
}
