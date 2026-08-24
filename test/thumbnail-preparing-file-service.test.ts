import { describe, expect, it, vi } from "vitest";
import { FileService } from "@/application/filesystem/file-service";
import { ThumbnailPreparingFileService } from "@/application/filesystem/thumbnail-preparing-file-service";
import { BACKGROUND_TASK_FAILURE_CODE } from "@/constants/platform/background-task";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { BackgroundTaskScheduler } from "@/types/platform/runtime";
import type { ThumbnailPreparer } from "@/types/filesystem/thumbnail";
import {
  MemoryFileRepository,
  MemoryObjectStorage,
  SequenceIdGenerator,
  StaticClock,
  streamFromText,
} from "@test/fakes";

const NOW = Date.parse("2026-08-23T00:00:00.000Z");

class CapturingBackgroundTaskScheduler implements BackgroundTaskScheduler {
  readonly tasks: Promise<unknown>[] = [];
  readonly failureCodes: string[] = [];

  schedule(task: Promise<unknown>, failureCode: string): void {
    this.tasks.push(task);
    this.failureCodes.push(failureCode);
  }
}

function createService(preparer: ThumbnailPreparer) {
  const scheduler = new CapturingBackgroundTaskScheduler();
  const files = new FileService(
    new MemoryFileRepository(),
    new MemoryObjectStorage(),
    new SequenceIdGenerator(["uploaded-file"]),
    new StaticClock(NOW),
  );
  return {
    scheduler,
    service: new ThumbnailPreparingFileService(files, preparer, scheduler),
  };
}

describe("ThumbnailPreparingFileService", () => {
  it("schedules supported image preparation without delaying upload", async () => {
    let finishPreparation: (() => void) | undefined;
    const preparation = new Promise<void>((resolve) => {
      finishPreparation = resolve;
    });
    const preparer: ThumbnailPreparer = {
      prepareThumbnail: vi.fn(() => preparation),
    };
    const { scheduler, service } = createService(preparer);

    const file = await service.uploadFile({
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      originalName: "image.png",
      contentType: "image/png",
      declaredSize: 5,
      body: streamFromText("image"),
    });

    expect(file.id).toBe("uploaded-file");
    expect(preparer.prepareThumbnail).toHaveBeenCalledWith(file.id);
    expect(scheduler.tasks).toEqual([preparation]);
    expect(scheduler.failureCodes).toEqual([
      BACKGROUND_TASK_FAILURE_CODE.THUMBNAIL_PREPARATION,
    ]);
    finishPreparation?.();
    await preparation;
  });

  it("does not schedule unsupported file types", async () => {
    const preparer: ThumbnailPreparer = {
      prepareThumbnail: vi.fn(),
    };
    const { scheduler, service } = createService(preparer);

    await service.uploadFile({
      originalName: "notes.txt",
      contentType: "text/plain",
      declaredSize: 5,
      body: streamFromText("notes"),
    });

    expect(preparer.prepareThumbnail).not.toHaveBeenCalled();
    expect(scheduler.tasks).toHaveLength(0);
  });

  it("keeps a completed upload successful when background preparation fails", async () => {
    let failPreparation: ((reason: Error) => void) | undefined;
    const preparation = new Promise<void>((_, reject) => {
      failPreparation = reject;
    });
    const { scheduler, service } = createService({
      prepareThumbnail: () => preparation,
    });

    const file = await service.uploadFile({
      originalName: "image.png",
      contentType: "image/png",
      declaredSize: 5,
      body: streamFromText("image"),
    });
    const rejection = expect(scheduler.tasks[0]).rejects.toThrow(
      "thumbnail failure",
    );
    failPreparation?.(new Error("thumbnail failure"));

    expect(file.id).toBe("uploaded-file");
    await rejection;
  });
});
