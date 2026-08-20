import { describe, expect, it } from "vitest";
import { FileService } from "../src/application/file-service";
import { FILE_ERRORS } from "../src/constants/errors/file";
import {
  DEFAULT_CONTENT_TYPE,
  FILE_OBJECT_KEY_PREFIX,
  FILE_STATUS,
  MAX_FILE_SIZE_BYTES,
} from "../src/constants/file";
import type { FileMetadata } from "../src/types/file";
import { MemoryFileRepository, MemoryObjectStorage, streamFromText } from "./fakes";

const TEST_FILE = {
  ID: "fixed-id",
  NAME: "보고서.txt",
  CONTENT_TYPE: "text/plain",
  BODY: "hello",
  SIZE: 5,
} as const;

const TEST_NOW_MS = 1_700_000_000_000;

function createService() {
  const repository = new MemoryFileRepository();
  const storage = new MemoryObjectStorage();
  const service = new FileService(
    repository,
    storage,
    { generate: () => TEST_FILE.ID },
    { now: () => TEST_NOW_MS },
  );
  return { repository, storage, service };
}

describe("FileService", () => {
  it("stores bytes separately and returns ready metadata", async () => {
    const { repository, storage, service } = createService();
    const file = await service.uploadFile({
      originalName: TEST_FILE.NAME,
      contentType: TEST_FILE.CONTENT_TYPE,
      declaredSize: TEST_FILE.SIZE,
      body: streamFromText(TEST_FILE.BODY),
    });

    expect(file).toEqual({
      id: TEST_FILE.ID,
      name: TEST_FILE.NAME,
      contentType: TEST_FILE.CONTENT_TYPE,
      size: TEST_FILE.SIZE,
      createdAt: new Date(TEST_NOW_MS).toISOString(),
    });
    expect(repository.records.get(TEST_FILE.ID)?.status).toBe(FILE_STATUS.READY);
    expect(
      storage.objects.has(`${FILE_OBJECT_KEY_PREFIX}/${TEST_FILE.ID}`),
    ).toBe(true);
  });

  it("removes pending metadata and object when stored size differs", async () => {
    const { repository, storage, service } = createService();
    storage.reportedSizeOffset = 1;

    await expect(
      service.uploadFile({
        originalName: "file.txt",
        contentType: TEST_FILE.CONTENT_TYPE,
        declaredSize: TEST_FILE.SIZE,
        body: streamFromText(TEST_FILE.BODY),
      }),
    ).rejects.toMatchObject({ code: FILE_ERRORS.FILE_SIZE_MISMATCH.code });
    expect(repository.records.size).toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it("rejects oversized files before persistence", async () => {
    const { repository, storage, service } = createService();

    await expect(
      service.uploadFile({
        originalName: "large.bin",
        contentType: DEFAULT_CONTENT_TYPE,
        declaredSize: MAX_FILE_SIZE_BYTES + 1,
        body: null,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        status: FILE_ERRORS.FILE_TOO_LARGE.status,
        code: FILE_ERRORS.FILE_TOO_LARGE.code,
      }),
    );
    expect(repository.records.size).toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it("paginates only ready files", async () => {
    const { repository, service } = createService();
    for (let index = 0; index < 3; index += 1) {
      const file: FileMetadata = {
        id: `id-${index}`,
        objectKey: `${FILE_OBJECT_KEY_PREFIX}/id-${index}`,
        originalName: `${index}.txt`,
        contentType: TEST_FILE.CONTENT_TYPE,
        size: 1,
        etag: "etag",
        status: FILE_STATUS.READY,
        createdAt: index,
      };
      repository.records.set(file.id, file);
    }
    repository.records.set("pending", {
      ...repository.records.get("id-0")!,
      id: "pending",
      objectKey: `${FILE_OBJECT_KEY_PREFIX}/pending`,
      status: FILE_STATUS.PENDING,
    });

    const firstPage = await service.listFiles(0, 2);
    const secondPage = await service.listFiles(firstPage.nextOffset!, 2);

    expect(firstPage.items.map((file) => file.id)).toEqual(["id-2", "id-1"]);
    expect(firstPage.nextOffset).toBe(2);
    expect(secondPage.items.map((file) => file.id)).toEqual(["id-0"]);
    expect(secondPage.nextOffset).toBeNull();
  });

  it("deletes the object before its metadata", async () => {
    const { repository, storage, service } = createService();
    await service.uploadFile({
      originalName: "file.txt",
      contentType: TEST_FILE.CONTENT_TYPE,
      declaredSize: TEST_FILE.SIZE,
      body: streamFromText(TEST_FILE.BODY),
    });

    await service.deleteFile(TEST_FILE.ID);

    expect(storage.objects.size).toBe(0);
    expect(repository.records.size).toBe(0);
  });
});
