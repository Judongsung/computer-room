import { describe, expect, it } from "vitest";
import { FileService } from "@/application/filesystem/file-service";
import { FilesystemPathService } from "@/application/filesystem/filesystem-path-service";
import { NovelAiImageService } from "@/application/integrations/novelai-image-service";
import { FILE_ERRORS } from "@/constants/filesystem/errors/file";
import { NOVELAI_ERRORS } from "@/constants/integrations/errors/novelai";
import { FILE_OBJECT_KEY_PREFIX } from "@/constants/filesystem/file";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { novelAiImageFileName } from "@/domain/integrations/novelai-image";
import { MemoryFileRepository } from "@test/support/filesystem/memory-filesystem-repository";
import { MemoryObjectStorage } from "@test/support/filesystem/memory-object-storage";
import {
  SequenceIdGenerator,
  StaticClock,
  streamFromText,
} from "@test/support/platform/runtime-fakes";

const KOREA_MIDNIGHT = Date.parse("2026-08-21T15:00:00.123Z");
const IMAGE_BODY = "png";

function createService(ids: readonly string[]) {
  const repository = new MemoryFileRepository();
  const storage = new MemoryObjectStorage();
  const idGenerator = new SequenceIdGenerator(ids);
  const clock = new StaticClock(KOREA_MIDNIGHT);
  const files = new FileService(repository, storage, idGenerator, clock);
  const paths = new FilesystemPathService(repository, idGenerator, clock);
  const service = new NovelAiImageService(paths, files, idGenerator, clock);
  return { clock, repository, storage, service };
}

describe("novelAiImageFileName", () => {
  it.each([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/gif", "gif"],
    ["image/webp", "webp"],
    ["image/avif", "avif"],
    ["image/bmp", "bmp"],
  ] as const)("maps %s to a server-generated .%s name", (contentType, extension) => {
    expect(
      novelAiImageFileName(KOREA_MIDNIGHT, "unique-id", contentType),
    ).toBe(`00-00-00-123_unique-id.${extension}`);
  });
});

describe("NovelAiImageService", () => {
  it("stores a streamed image under Desktop/NovelAI/Korea-date", async () => {
    const { repository, storage, service } = createService([
      "novelai-directory",
      "date-directory",
      "name-id",
      "file-id",
    ]);

    const file = await service.uploadImage({
      contentType: "IMAGE/PNG; charset=binary",
      declaredSize: IMAGE_BODY.length,
      body: streamFromText(IMAGE_BODY),
    });

    expect(repository.records.get("novelai-directory")).toMatchObject({
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      name: "NovelAI",
      desktopOrder: 0,
    });
    expect(repository.records.get("date-directory")).toMatchObject({
      parentId: "novelai-directory",
      name: "2026-08-22",
    });
    expect(file).toMatchObject({
      id: "file-id",
      parentId: "date-directory",
      name: "00-00-00-123_name-id.png",
      contentType: "image/png",
      size: IMAGE_BODY.length,
    });
    expect(
      storage.objects.get(`${FILE_OBJECT_KEY_PREFIX}/file-id`)?.bytes,
    ).toEqual(new TextEncoder().encode(IMAGE_BODY));
  });

  it("stores repeated image bytes as distinct files", async () => {
    const { repository, storage, service } = createService([
      "novelai-directory",
      "date-directory",
      "first-name",
      "first-file",
      "unused-novelai-directory",
      "unused-date-directory",
      "second-name",
      "second-file",
    ]);
    const input = {
      contentType: "image/png",
      declaredSize: IMAGE_BODY.length,
      body: streamFromText(IMAGE_BODY),
    };

    const first = await service.uploadImage(input);
    const second = await service.uploadImage({
      ...input,
      body: streamFromText(IMAGE_BODY),
    });

    expect(first.id).not.toBe(second.id);
    expect(first.name).not.toBe(second.name);
    expect(storage.objects.size).toBe(2);
    expect(
      [...repository.records.values()].filter(
        (entry) => entry.name === "NovelAI",
      ),
    ).toHaveLength(1);
  });

  it("switches date directories at Korean midnight", async () => {
    const { clock, repository, service } = createService([
      "novelai-directory",
      "first-date-directory",
      "first-name",
      "first-file",
      "unused-novelai-directory",
      "second-date-directory",
      "second-name",
      "second-file",
    ]);
    clock.timestamp = Date.parse("2026-08-21T14:59:59.999Z");

    const first = await service.uploadImage({
      contentType: "image/png",
      declaredSize: IMAGE_BODY.length,
      body: streamFromText(IMAGE_BODY),
    });
    clock.timestamp = Date.parse("2026-08-21T15:00:00.000Z");
    const second = await service.uploadImage({
      contentType: "image/png",
      declaredSize: IMAGE_BODY.length,
      body: streamFromText(IMAGE_BODY),
    });

    expect(repository.records.get(first.parentId)?.name).toBe("2026-08-21");
    expect(repository.records.get(second.parentId)?.name).toBe("2026-08-22");
    expect(first.name).toBe("23-59-59-999_first-name.png");
    expect(second.name).toBe("00-00-00-000_second-name.png");
  });

  it("rejects non-image content before creating folders", async () => {
    const { repository, storage, service } = createService([]);

    await expect(
      service.uploadImage({
        contentType: "text/plain",
        declaredSize: 1,
        body: streamFromText("x"),
      }),
    ).rejects.toMatchObject({
      status: NOVELAI_ERRORS.UNSUPPORTED_IMAGE_TYPE.status,
      code: NOVELAI_ERRORS.UNSUPPORTED_IMAGE_TYPE.code,
    });
    expect(repository.records.size).toBe(3);
    expect(storage.objects.size).toBe(0);
  });

  it("removes pending file metadata when R2 storage fails", async () => {
    const { repository, storage, service } = createService([
      "novelai-directory",
      "date-directory",
      "name-id",
      "file-id",
    ]);
    storage.failOnPut = true;

    await expect(
      service.uploadImage({
        contentType: "image/png",
        declaredSize: IMAGE_BODY.length,
        body: streamFromText(IMAGE_BODY),
      }),
    ).rejects.toThrow("Storage failure");
    expect(repository.records.has("file-id")).toBe(false);
    expect(storage.objects.size).toBe(0);
  });

  it("delegates missing-body validation to the shared file service", async () => {
    const { service } = createService([
      "novelai-directory",
      "date-directory",
      "name-id",
      "file-id",
    ]);

    await expect(
      service.uploadImage({
        contentType: "image/png",
        declaredSize: 1,
        body: null,
      }),
    ).rejects.toMatchObject({ code: FILE_ERRORS.MISSING_FILE_BODY.code });
  });
});
