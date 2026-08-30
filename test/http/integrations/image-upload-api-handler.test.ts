import { describe, expect, it, vi } from "vitest";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { IMAGE_UPLOAD_LOG_OUTCOME } from "@/constants/integrations/image-upload-log";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { HTTP_HEADERS, HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import { ImageUploadApiHandler } from "@/http/integrations/image-upload-api-handler";
import type { ImageUploadLogRecorder } from "@/types/integrations/image-upload-log";
import type { ImageUploadUseCases } from "@/types/integrations/image-upload";
import type { BackgroundTaskScheduler } from "@/types/platform/runtime";
import { StaticClock } from "@test/support/platform/runtime-fakes";

const REQUEST_URL = "https://example.com/api/integrations/novelai/images";

describe("ImageUploadApiHandler logging", () => {
  it("does not fail a successful upload when background logging fails", async () => {
    const scheduler = new CapturingBackgroundTaskScheduler();
    const images: ImageUploadUseCases = {
      uploadImage: vi.fn(async () => uploadedFile()),
    };
    const logs: ImageUploadLogRecorder = {
      record: vi.fn(() => {
        throw new Error("log storage unavailable");
      }),
    };
    const handler = new ImageUploadApiHandler(
      images,
      logs,
      new StaticClock(100),
      scheduler,
    );

    const response = await handler.handle(uploadRequest(), new URL(REQUEST_URL));
    expect(response?.status).toBe(HTTP_STATUS.CREATED);
    await scheduler.settle();
    expect(logs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS,
        profileId: "novelai",
      }),
    );
  });

  it("records the safe public error while preserving the original failure", async () => {
    const scheduler = new CapturingBackgroundTaskScheduler();
    const images: ImageUploadUseCases = {
      uploadImage: vi.fn(async () => {
        throw new AppError(HTTP_ERRORS.UNSUPPORTED_MEDIA_TYPE);
      }),
    };
    const logs: ImageUploadLogRecorder = { record: vi.fn(async () => undefined) };
    const handler = new ImageUploadApiHandler(
      images,
      logs,
      new StaticClock(100),
      scheduler,
    );

    await expect(
      handler.handle(uploadRequest(), new URL(REQUEST_URL)),
    ).rejects.toMatchObject({ code: HTTP_ERRORS.UNSUPPORTED_MEDIA_TYPE.code });
    await scheduler.settle();
    expect(logs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: IMAGE_UPLOAD_LOG_OUTCOME.FAILURE,
        error: HTTP_ERRORS.UNSUPPORTED_MEDIA_TYPE,
      }),
    );
  });
});

class CapturingBackgroundTaskScheduler implements BackgroundTaskScheduler {
  private readonly tasks: Promise<unknown>[] = [];

  schedule(task: Promise<unknown>): void {
    this.tasks.push(task.catch(() => undefined));
  }

  async settle(): Promise<void> {
    await Promise.all(this.tasks);
  }
}

function uploadRequest(): Request {
  return new Request(REQUEST_URL, {
    method: HTTP_METHOD.POST,
    headers: {
      [HTTP_HEADERS.CONTENT_TYPE]: "image/png",
      [HTTP_HEADERS.FILE_SIZE]: "3",
    },
    body: "png",
  });
}

function uploadedFile() {
  return {
    id: "file",
    parentId: "directory",
    kind: FILESYSTEM_ENTRY_KIND.FILE,
    name: "saved.png",
    contentType: "image/png",
    size: 3,
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
    desktopOrder: null,
  } as const;
}
