import { describe, expect, it, vi } from "vitest";
import { ImageUploadLogSettingsService } from "@/application/integrations/image-upload-log-settings-service";
import { IMAGE_UPLOAD_LOG_ERRORS } from "@/constants/integrations/errors/image-upload-log";
import type { ImageUploadLogSettingsRepository } from "@/types/integrations/image-upload-log";

describe("ImageUploadLogSettingsService", () => {
  it("reads and updates valid retention periods", async () => {
    const repository = memorySettingsRepository(30);
    const service = new ImageUploadLogSettingsService(repository);

    await expect(service.getSettings()).resolves.toEqual({ retentionDays: 30 });
    await expect(service.updateRetentionDays(90)).resolves.toEqual({
      retentionDays: 90,
    });
    expect(repository.saveRetentionDays).toHaveBeenCalledWith(90);
  });

  it.each([0, 1.5, 366])("rejects invalid retention days: %s", async (value) => {
    const repository = memorySettingsRepository(30);
    const service = new ImageUploadLogSettingsService(repository);

    await expect(service.updateRetentionDays(value)).rejects.toMatchObject({
      code: IMAGE_UPLOAD_LOG_ERRORS.INVALID_RETENTION_DAYS.code,
    });
    expect(repository.saveRetentionDays).not.toHaveBeenCalled();
  });
});

function memorySettingsRepository(
  retentionDays: number,
): ImageUploadLogSettingsRepository {
  return {
    getSettings: vi.fn(async () => ({ retentionDays })),
    saveRetentionDays: vi.fn(async () => undefined),
  };
}
