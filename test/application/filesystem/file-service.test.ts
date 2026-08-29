import { describe, expect, it } from "vitest";
import { FileService } from "@/application/filesystem/file-service";
import { FILE_ERRORS } from "@/constants/filesystem/errors/file";
import { BYTE_RANGE_KIND } from "@/constants/filesystem/media";
import { FILE_UPLOAD_COMPENSATION_STEP } from "@/constants/filesystem/observability";
import {
  DEFAULT_CONTENT_TYPE,
  FILE_OBJECT_KEY_PREFIX,
  FILE_STATUS,
  MAX_FILE_SIZE_BYTES,
} from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { MemoryFileRepository } from "@test/support/filesystem/memory-filesystem-repository";
import { MemoryObjectStorage } from "@test/support/filesystem/memory-object-storage";
import { RecordingFileUploadCompensationObserver } from "@test/support/filesystem/file-upload-compensation-observer";
import { streamFromText } from "@test/support/platform/runtime-fakes";

const TEST_FILE = {
  ID: "fixed-id",
  NAME: "보고서.txt",
  CONTENT_TYPE: "text/plain",
  BODY: "hello",
  SIZE: 5,
} as const;
const TEST_NOW_MS = 1_700_000_000_000;

function createService(ids: readonly string[] = [TEST_FILE.ID]) {
  const repository = new MemoryFileRepository();
  const storage = new MemoryObjectStorage();
  const compensationObserver = new RecordingFileUploadCompensationObserver();
  let index = 0;
  const service = new FileService(
    repository,
    storage,
    { generate: () => ids[index++] ?? "missing-id" },
    { now: () => TEST_NOW_MS + index },
    compensationObserver,
  );
  return { compensationObserver, repository, storage, service };
}

describe("FileService", () => {
  it("stores R2 bytes separately and returns a ready filesystem entry", async () => {
    const { repository, storage, service } = createService();
    const file = await service.uploadFile({
      originalName: TEST_FILE.NAME,
      contentType: TEST_FILE.CONTENT_TYPE,
      declaredSize: TEST_FILE.SIZE,
      body: streamFromText(TEST_FILE.BODY),
    });

    expect(file).toMatchObject({
      id: TEST_FILE.ID,
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      kind: FILESYSTEM_ENTRY_KIND.FILE,
      name: TEST_FILE.NAME,
      contentType: TEST_FILE.CONTENT_TYPE,
      size: TEST_FILE.SIZE,
    });
    expect(repository.records.get(TEST_FILE.ID)?.fileStatus).toBe(FILE_STATUS.READY);
    expect(storage.objects.has(`${FILE_OBJECT_KEY_PREFIX}/${TEST_FILE.ID}`)).toBe(true);
  });

  it("removes pending metadata and object when stored size differs", async () => {
    const { compensationObserver, repository, storage, service } =
      createService();
    storage.reportedSizeOffset = 1;

    await expect(
      service.uploadFile({
        originalName: "file.txt",
        contentType: TEST_FILE.CONTENT_TYPE,
        declaredSize: TEST_FILE.SIZE,
        body: streamFromText(TEST_FILE.BODY),
      }),
    ).rejects.toMatchObject({ code: FILE_ERRORS.FILE_SIZE_MISMATCH.code });
    expect(repository.records.has(TEST_FILE.ID)).toBe(false);
    expect(storage.objects.size).toBe(0);
    expect(compensationObserver.events).toEqual([]);
  });

  it.each([
    {
      name: "R2 object cleanup",
      failObjectDelete: true,
      failMetadataDelete: false,
      expectedSteps: [
        FILE_UPLOAD_COMPENSATION_STEP.OBJECT_STORAGE_DELETE,
      ],
    },
    {
      name: "D1 metadata cleanup",
      failObjectDelete: false,
      failMetadataDelete: true,
      expectedSteps: [
        FILE_UPLOAD_COMPENSATION_STEP.FILE_METADATA_DELETE,
      ],
    },
    {
      name: "both cleanup operations",
      failObjectDelete: true,
      failMetadataDelete: true,
      expectedSteps: [
        FILE_UPLOAD_COMPENSATION_STEP.OBJECT_STORAGE_DELETE,
        FILE_UPLOAD_COMPENSATION_STEP.FILE_METADATA_DELETE,
      ],
    },
  ])(
    "reports $name failure without replacing the upload error",
    async ({ failObjectDelete, failMetadataDelete, expectedSteps }) => {
      const { compensationObserver, repository, storage, service } =
        createService();
      storage.reportedSizeOffset = 1;
      storage.failOnDelete = failObjectDelete;
      repository.failOnDeleteFileMetadata = failMetadataDelete;

      await expect(
        service.uploadFile({
          originalName: "file.txt",
          contentType: TEST_FILE.CONTENT_TYPE,
          declaredSize: TEST_FILE.SIZE,
          body: streamFromText(TEST_FILE.BODY),
        }),
      ).rejects.toMatchObject({ code: FILE_ERRORS.FILE_SIZE_MISMATCH.code });

      expect(compensationObserver.events).toHaveLength(1);
      expect(compensationObserver.events[0]?.entryId).toBe(TEST_FILE.ID);
      expect(
        compensationObserver.events[0]?.failures.map(({ step }) => step),
      ).toEqual(expectedSteps);
      expect(
        compensationObserver.events[0]?.failures.every(
          ({ cause }) => cause instanceof Error,
        ),
      ).toBe(true);
    },
  );

  it("rejects oversized files before persistence", async () => {
    const { repository, storage, service } = createService();
    await expect(
      service.uploadFile({
        originalName: "large.bin",
        contentType: DEFAULT_CONTENT_TYPE,
        declaredSize: MAX_FILE_SIZE_BYTES + 1,
        body: null,
      }),
    ).rejects.toMatchObject({
      status: FILE_ERRORS.FILE_TOO_LARGE.status,
      code: FILE_ERRORS.FILE_TOO_LARGE.code,
    });
    expect(repository.records.size).toBe(3);
    expect(storage.objects.size).toBe(0);
  });

  it("adds a number before the extension when a sibling name already exists", async () => {
    const { service } = createService(["file-1", "file-2"]);
    const first = await service.uploadFile({
      originalName: "photo.png",
      contentType: "image/png",
      declaredSize: 1,
      body: streamFromText("a"),
    });
    const second = await service.uploadFile({
      originalName: "PHOTO.PNG",
      contentType: "image/png",
      declaredSize: 1,
      body: streamFromText("b"),
    });
    expect(first.name).toBe("photo.png");
    expect(second.name).toBe("PHOTO (2).PNG");
  });

  it("streams only the requested byte range for supported media", async () => {
    const { service } = createService();
    await service.uploadFile({
      originalName: "photo.png",
      contentType: "image/png",
      declaredSize: TEST_FILE.SIZE,
      body: streamFromText(TEST_FILE.BODY),
    });

    const content = await service.streamFile(TEST_FILE.ID, {
      kind: BYTE_RANGE_KIND.CLOSED,
      start: 1,
      end: 3,
    });
    expect(content.range).toEqual({ offset: 1, length: 3 });
    await expect(new Response(content.object.body).text()).resolves.toBe("ell");
    expect(content.object.size).toBe(TEST_FILE.SIZE);
  });

  it("rejects non-media files from the content stream", async () => {
    const { service } = createService();
    await service.uploadFile({
      originalName: TEST_FILE.NAME,
      contentType: TEST_FILE.CONTENT_TYPE,
      declaredSize: TEST_FILE.SIZE,
      body: streamFromText(TEST_FILE.BODY),
    });

    await expect(service.streamFile(TEST_FILE.ID)).rejects.toMatchObject({
      code: FILE_ERRORS.UNSUPPORTED_MEDIA_TYPE.code,
    });
  });
});
