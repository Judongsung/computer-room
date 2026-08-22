import { describe, expect, it } from "vitest";
import { FileService } from "../src/application/file-service";
import { FILE_ERRORS } from "../src/constants/errors/file";
import { BYTE_RANGE_KIND } from "../src/constants/media";
import {
  DEFAULT_CONTENT_TYPE,
  FILE_OBJECT_KEY_PREFIX,
  FILE_STATUS,
  MAX_FILE_SIZE_BYTES,
} from "../src/constants/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "../src/constants/filesystem";
import { MemoryFileRepository, MemoryObjectStorage, streamFromText } from "./fakes";

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
  let index = 0;
  const service = new FileService(
    repository,
    storage,
    { generate: () => ids[index++] ?? "missing-id" },
    { now: () => TEST_NOW_MS + index },
  );
  return { repository, storage, service };
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
    expect(repository.records.has(TEST_FILE.ID)).toBe(false);
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

  it("keeps the legacy list endpoint compatible with files in nested folders", async () => {
    const { repository, service } = createService();
    await repository.insertDirectory({
      id: "archive-directory",
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "보관함",
      nameKey: "보관함",
      createdAt: TEST_NOW_MS - 1,
    });
    await service.uploadFile({
      parentId: "archive-directory",
      originalName: TEST_FILE.NAME,
      contentType: TEST_FILE.CONTENT_TYPE,
      declaredSize: TEST_FILE.SIZE,
      body: streamFromText(TEST_FILE.BODY),
    });

    await expect(service.listFiles(0, 20)).resolves.toMatchObject({
      items: [{ id: TEST_FILE.ID, name: TEST_FILE.NAME }],
      nextOffset: null,
    });
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
