import { describe, expect, it, vi } from "vitest";
import { ImageUploadLogPurgeJob } from "@/application/integrations/image-upload-log-purge-job";
import { BACKGROUND_TASK_FAILURE_CODE } from "@/constants/platform/background-task";

describe("ImageUploadLogPurgeJob", () => {
  it("uses the shared retention policy and its dedicated failure code", async () => {
    const purgeBefore = vi.fn(async () => 3);
    const getSettings = vi.fn(async () => ({ retentionDays: 30 }));
    const job = new ImageUploadLogPurgeJob({ purgeBefore }, { getSettings });
    const scheduledTime = Date.parse("2026-08-30T15:00:00.000Z");

    await expect(job.run(scheduledTime)).resolves.toBe(3);
    expect(job.failureCode).toBe(
      BACKGROUND_TASK_FAILURE_CODE.IMAGE_UPLOAD_LOG_PURGE,
    );
    expect(purgeBefore).toHaveBeenCalledWith(
      Date.parse("2026-07-31T15:00:00.000Z"),
    );
    expect(getSettings).toHaveBeenCalledOnce();
  });
});
