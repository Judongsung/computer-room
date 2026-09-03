import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IMAGE_UPLOAD_LOG_RETENTION } from "@/constants/integrations/image-upload-log";
import { D1ImageUploadLogSettingsRepository } from "@/infrastructure/integrations/d1-image-upload-log-settings-repository";

interface ImageUploadLogTestEnvironment {
  readonly IMAGE_UPLOAD_LOG_TEST_DB: D1Database;
  readonly TEST_MIGRATIONS: readonly D1Migration[];
}

const testEnvironment = env as typeof env & ImageUploadLogTestEnvironment;
const database = testEnvironment.IMAGE_UPLOAD_LOG_TEST_DB;
const repository = new D1ImageUploadLogSettingsRepository(database);

beforeAll(async () => {
  await applyD1Migrations(database, [...testEnvironment.TEST_MIGRATIONS]);
});

beforeEach(async () => {
  await database
    .prepare(
      "UPDATE integration_image_upload_log_settings SET retention_days = ?1 WHERE singleton_id = 1",
    )
    .bind(IMAGE_UPLOAD_LOG_RETENTION.DEFAULT_DAYS)
    .run();
});

describe("D1ImageUploadLogSettingsRepository", () => {
  it("reads the default and persists updated retention days", async () => {
    await expect(repository.getSettings()).resolves.toEqual({
      retentionDays: IMAGE_UPLOAD_LOG_RETENTION.DEFAULT_DAYS,
    });

    await repository.saveRetentionDays(90);

    await expect(repository.getSettings()).resolves.toEqual({
      retentionDays: 90,
    });
  });

  it.each([0, 366])("keeps the database range constraint: %s", async (value) => {
    await expect(repository.saveRetentionDays(value)).rejects.toThrow();
  });
});
