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
        sourceIp: "203.0.113.8",
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
        sourceIp: "203.0.113.8",
        error: HTTP_ERRORS.UNSUPPORTED_MEDIA_TYPE,
      }),
    );
  });

  it("normalizes IPv6 and ignores malformed or missing client IP headers", async () => {
    const scheduler = new CapturingBackgroundTaskScheduler();
    const images: ImageUploadUseCases = {
      uploadImage: vi.fn(async () => uploadedFile()),
    };
    const logs: ImageUploadLogRecorder = { record: vi.fn(async () => undefined) };
    const handler = new ImageUploadApiHandler(
      images,
      logs,
      new StaticClock(100),
      scheduler,
    );

    await handler.handle(uploadRequest("2001:db8::8"), new URL(REQUEST_URL));
    await handler.handle(uploadRequest("not-an-ip"), new URL(REQUEST_URL));
    await handler.handle(uploadRequest(null), new URL(REQUEST_URL));
    await scheduler.settle();

    expect(logs.record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sourceIp: "2001:db8::8" }),
    );
    expect(logs.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sourceIp: null }),
    );
    expect(logs.record).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ sourceIp: null }),
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

function uploadRequest(sourceIp: string | null = "203.0.113.8"): Request {
  const headers = new Headers({
    [HTTP_HEADERS.CONTENT_TYPE]: "image/png",
    [HTTP_HEADERS.FILE_SIZE]: "3",
  });
  if (sourceIp !== null) {
    headers.set(HTTP_HEADERS.CF_CONNECTING_IP, sourceIp);
  }
  return new Request(REQUEST_URL, {
    method: HTTP_METHOD.POST,
    headers,
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
