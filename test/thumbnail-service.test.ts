import { describe, expect, it, vi } from "vitest";
import { FileService } from "../src/application/file-service";
import { FilesystemService } from "../src/application/filesystem-service";
import { ThumbnailService } from "../src/application/thumbnail-service";
import { THUMBNAIL_ERRORS } from "../src/constants/errors/thumbnail";
import { FILE_ERRORS } from "../src/constants/errors/file";
import { FILE_OBJECT_KEY_PREFIX } from "../src/constants/file";
import { FILESYSTEM_ROOT_ID } from "../src/constants/filesystem";
import { THUMBNAIL_SPEC } from "../src/constants/thumbnail";
import { thumbnailObjectKey } from "../src/domain/thumbnail";
import type {
  GeneratedThumbnail,
  ImageThumbnailGenerator,
} from "../src/types/thumbnail";
import {
  MemoryFileRepository,
  MemoryObjectStorage,
  SequenceIdGenerator,
  StaticClock,
  streamFromText,
} from "./fakes";

const FILE_ID = "thumbnail-source";
const NOW = Date.parse("2026-08-23T00:00:00.000Z");

class FakeThumbnailGenerator implements ImageThumbnailGenerator {
  calls = 0;
  fail = false;

  async generate(
    source: ReadableStream<Uint8Array>,
  ): Promise<GeneratedThumbnail> {
    this.calls += 1;
    await new Response(source).arrayBuffer();
    if (this.fail) {
      throw new Error("Image transform failure");
    }
    return {
      body: await new Blob(["thumbnail"]).arrayBuffer(),
      contentType: THUMBNAIL_SPEC.OUTPUT_CONTENT_TYPE,
    };
  }
}

function createServices() {
  const repository = new MemoryFileRepository();
  const storage = new MemoryObjectStorage();
  const ids = new SequenceIdGenerator([FILE_ID]);
  const clock = new StaticClock(NOW);
  const generator = new FakeThumbnailGenerator();
  return {
    repository,
    storage,
    generator,
    files: new FileService(repository, storage, ids, clock),
    filesystem: new FilesystemService(repository, ids, clock),
    thumbnails: new ThumbnailService(repository, storage, generator),
  };
}

async function uploadImage(
  services: ReturnType<typeof createServices>,
  contentType = "image/png",
) {
  return services.files.uploadFile({
    originalName: "image.png",
    contentType,
    declaredSize: 5,
    body: streamFromText("image"),
  });
}

describe("ThumbnailService", () => {
  it("generates a WebP once and reuses the deterministic R2 object", async () => {
    const services = createServices();
    const file = await uploadImage(services);
    services.storage.getKeys.length = 0;
    services.storage.putKeys.length = 0;
    const findEntry = vi.spyOn(services.repository, "findEntry");
    const findEntryWithinRoots = vi.spyOn(
      services.repository,
      "findEntryWithinRoots",
    );

    const first = await services.thumbnails.getThumbnail(file.id);
    await expect(new Response(first.body).text()).resolves.toBe("thumbnail");
    expect(first.contentType).toBe(THUMBNAIL_SPEC.OUTPUT_CONTENT_TYPE);
    expect(services.generator.calls).toBe(1);
    expect(services.storage.objects.has(thumbnailObjectKey(file.id))).toBe(true);
    expect(services.storage.getKeys).toEqual([
      thumbnailObjectKey(file.id),
      `${FILE_OBJECT_KEY_PREFIX}/${file.id}`,
    ]);
    expect(services.storage.putKeys).toEqual([thumbnailObjectKey(file.id)]);
    expect(findEntryWithinRoots).toHaveBeenCalledOnce();
    expect(findEntry).not.toHaveBeenCalled();

    const second = await services.thumbnails.getThumbnail(file.id);
    await expect(new Response(second.body).text()).resolves.toBe("thumbnail");
    expect(services.generator.calls).toBe(1);
  });

  it("rejects a ready image that is outside every readable system root", async () => {
    const services = createServices();
    const file = await uploadImage(services);
    const stored = services.repository.records.get(file.id);
    if (!stored) throw new Error("Expected uploaded file");
    services.repository.records.set(file.id, { ...stored, parentId: null });

    await expect(
      services.thumbnails.getThumbnail(file.id),
    ).rejects.toMatchObject({ code: FILE_ERRORS.FILE_NOT_FOUND.code });
    expect(services.generator.calls).toBe(0);
  });

  it("keeps thumbnails readable while a file is in the recycle bin", async () => {
    const services = createServices();
    const file = await uploadImage(services);
    await services.filesystem.trashEntry(file.id);

    const thumbnail = await services.thumbnails.getThumbnail(file.id);

    await expect(new Response(thumbnail.body).text()).resolves.toBe("thumbnail");
    expect(services.generator.calls).toBe(1);
  });

  it("prepares a reusable thumbnail without requiring a foreground request", async () => {
    const services = createServices();
    const file = await uploadImage(services);

    await services.thumbnails.prepareThumbnail(file.id);
    expect(services.storage.objects.has(thumbnailObjectKey(file.id))).toBe(true);

    const thumbnail = await services.thumbnails.getThumbnail(file.id);
    await expect(new Response(thumbnail.body).text()).resolves.toBe("thumbnail");
    expect(services.generator.calls).toBe(1);
  });

  it("rejects unsupported and oversized sources before transformation", async () => {
    const unsupported = createServices();
    const bitmap = await uploadImage(unsupported, "image/bmp");
    await expect(
      unsupported.thumbnails.getThumbnail(bitmap.id),
    ).rejects.toMatchObject({
      code: THUMBNAIL_ERRORS.UNSUPPORTED_SOURCE.code,
    });
    expect(unsupported.generator.calls).toBe(0);

    const oversized = createServices();
    await oversized.repository.insertPendingFile({
      entry: {
        id: FILE_ID,
        parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
        name: "large.png",
        nameKey: "large.png",
        createdAt: NOW,
      },
      objectKey: `${FILE_OBJECT_KEY_PREFIX}/${FILE_ID}`,
      contentType: "image/png",
      size: THUMBNAIL_SPEC.MAX_SOURCE_SIZE_BYTES + 1,
    });
    await oversized.repository.markFileReady(
      FILE_ID,
      THUMBNAIL_SPEC.MAX_SOURCE_SIZE_BYTES + 1,
      "oversized-etag",
    );
    await expect(
      oversized.thumbnails.getThumbnail(FILE_ID),
    ).rejects.toMatchObject({
      code: THUMBNAIL_ERRORS.SOURCE_TOO_LARGE.code,
    });
    expect(oversized.generator.calls).toBe(0);
  });

  it("translates transformer failures without exposing infrastructure details", async () => {
    const services = createServices();
    const file = await uploadImage(services);
    services.generator.fail = true;

    await expect(
      services.thumbnails.getThumbnail(file.id),
    ).rejects.toMatchObject({
      code: THUMBNAIL_ERRORS.GENERATION_FAILED.code,
      message: THUMBNAIL_ERRORS.GENERATION_FAILED.message,
    });
    expect(services.storage.objects.has(thumbnailObjectKey(file.id))).toBe(false);
  });
});
