import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IMAGE_UPLOAD_LOG_OUTCOME } from "@/constants/integrations/image-upload-log";
import { D1ImageUploadLogRepository } from "@/infrastructure/integrations/d1-image-upload-log-repository";
import type { StoredImageUploadLog } from "@/types/integrations/image-upload-log";

interface ImageUploadLogTestEnvironment {
  readonly IMAGE_UPLOAD_LOG_TEST_DB: D1Database;
  readonly TEST_MIGRATIONS: readonly D1Migration[];
}

const testEnvironment = env as typeof env & ImageUploadLogTestEnvironment;
const database = testEnvironment.IMAGE_UPLOAD_LOG_TEST_DB;
const repository = new D1ImageUploadLogRepository(database);

beforeAll(async () => {
  await applyD1Migrations(database, [...testEnvironment.TEST_MIGRATIONS]);
});

beforeEach(async () => {
  await database.prepare("DELETE FROM integration_image_upload_logs").run();
});

describe("D1ImageUploadLogRepository", () => {
  it("filters and pages deterministically by profile, outcome, time, and id", async () => {
    await repository.insert(failureLog("a", "novelai", 100));
    await repository.insert(failureLog("b", "novelai", 100));
    await repository.insert(failureLog("c", "camera", 200));
    await repository.insert(successLog("d", "novelai", 300));

    await expect(
      repository.list({
        cutoff: 0,
        limit: 2,
        profileId: "novelai",
      }),
    ).resolves.toMatchObject([
      { id: "d", sourceIp: "2001:db8::8" },
      { id: "b", sourceIp: "203.0.113.8" },
    ]);
    await expect(
      repository.list({
        cutoff: 0,
        limit: 10,
        profileId: "novelai",
        outcome: IMAGE_UPLOAD_LOG_OUTCOME.FAILURE,
        cursor: { receivedAt: 100, id: "b" },
      }),
    ).resolves.toMatchObject([{ id: "a" }]);
  });

  it("purges only records older than the cutoff", async () => {
    await repository.insert(failureLog("older", "novelai", 99));
    await repository.insert(failureLog("boundary", "novelai", 100));

    await expect(repository.purgeBefore(100)).resolves.toBe(1);
    await expect(
      repository.list({ cutoff: 0, limit: 10 }),
    ).resolves.toMatchObject([{ id: "boundary" }]);
  });
});

function failureLog(
  id: string,
  profileId: string,
  receivedAt: number,
): StoredImageUploadLog {
  return {
    id,
    profileId,
    sourceIp: "203.0.113.8",
    outcome: IMAGE_UPLOAD_LOG_OUTCOME.FAILURE,
    contentType: "image/png",
    declaredSize: 4,
    fileEntryId: null,
    fileName: null,
    httpStatus: 415,
    errorCode: "UNSUPPORTED",
    errorMessage: "Unsupported",
    receivedAt,
    durationMs: 1,
  };
}

function successLog(
  id: string,
  profileId: string,
  receivedAt: number,
): StoredImageUploadLog {
  return {
    id,
    profileId,
    sourceIp: "2001:db8::8",
    outcome: IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS,
    contentType: "image/png",
    declaredSize: 4,
    fileEntryId: "file-entry",
    fileName: "saved.png",
    httpStatus: 201,
    errorCode: null,
    errorMessage: null,
    receivedAt,
    durationMs: 1,
  };
}
