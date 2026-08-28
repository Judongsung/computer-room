import { describe, expect, it } from "vitest";
import { FileService } from "@/application/filesystem/file-service";
import { FilesystemPathService } from "@/application/filesystem/filesystem-path-service";
import { ImageUploadService } from "@/application/integrations/image-upload-service";
import { FILE_ERRORS } from "@/constants/filesystem/errors/file";
import { FILE_OBJECT_KEY_PREFIX } from "@/constants/filesystem/file";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { IMAGE_UPLOAD_ERRORS } from "@/constants/integrations/errors/image-upload";
import { IMAGE_UPLOAD_PROFILE_ERRORS } from "@/constants/integrations/errors/image-upload-profile";
import { NOVELAI_ERRORS } from "@/constants/integrations/errors/novelai";
import {
  DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE,
  IMAGE_UPLOAD_CONTENT_TYPE,
} from "@/constants/integrations/image-upload-profile";
import { AppError } from "@/domain/shared/errors";
import type {
  ImageUploadProfile,
  ImageUploadProfileReader,
} from "@/types/integrations/image-upload-profile";
import { MemoryFileRepository } from "@test/support/filesystem/memory-filesystem-repository";
import { MemoryObjectStorage } from "@test/support/filesystem/memory-object-storage";
import {
  SequenceIdGenerator,
  StaticClock,
  streamFromText,
} from "@test/support/platform/runtime-fakes";

const KOREA_MIDNIGHT = Date.parse("2026-08-21T15:00:00.123Z");
const IMAGE_BODY = "png";

function createService(
  ids: readonly string[],
  profile: ImageUploadProfile = novelAiProfile(),
) {
  const repository = new MemoryFileRepository();
  const storage = new MemoryObjectStorage();
  const idGenerator = new SequenceIdGenerator(ids);
  const clock = new StaticClock(KOREA_MIDNIGHT);
  const files = new FileService(repository, storage, idGenerator, clock);
  const paths = new FilesystemPathService(repository, idGenerator, clock);
  const profiles: ImageUploadProfileReader = {
    async requireEnabledProfile(id) {
      if (id !== profile.id || !profile.enabled) {
        throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.NOT_FOUND);
      }
      return profile;
    },
  };
  const service = new ImageUploadService(
    profiles,
    paths,
    files,
    idGenerator,
    clock,
  );
  return { clock, repository, storage, service };
}

describe("ImageUploadService", () => {
  it("preserves the NovelAI desktop path and file name contract", async () => {
    const { repository, storage, service } = createService([
      "name-id",
      "novelai-directory",
      "date-directory",
      "file-id",
    ]);

    const file = await service.uploadImage("novelai", {
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

  it("applies a custom root, path, file name, and MIME policy", async () => {
    const profile = profileWith({
      id: "capture",
      rootId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      pathTemplate: "{profileId}/{yyyy-MM-dd}",
      fileNameTemplate: "capture_{uuid}.{ext}",
      contentTypes: [IMAGE_UPLOAD_CONTENT_TYPE.WEBP],
    });
    const { repository, service } = createService(
      ["uuid", "base", "date", "file"],
      profile,
    );

    const file = await service.uploadImage(profile.id, {
      contentType: IMAGE_UPLOAD_CONTENT_TYPE.WEBP,
      declaredSize: IMAGE_BODY.length,
      body: streamFromText(IMAGE_BODY),
    });

    expect(repository.records.get("base")).toMatchObject({
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "capture",
    });
    expect(file.name).toBe("capture_uuid.webp");
  });

  it("switches date directories at Korean midnight", async () => {
    const { clock, repository, service } = createService([
      "first-name",
      "novelai-directory",
      "first-date-directory",
      "first-file",
      "second-name",
      "unused-novelai-directory",
      "second-date-directory",
      "second-file",
    ]);
    clock.timestamp = Date.parse("2026-08-21T14:59:59.999Z");
    const input = {
      contentType: IMAGE_UPLOAD_CONTENT_TYPE.PNG,
      declaredSize: IMAGE_BODY.length,
      body: streamFromText(IMAGE_BODY),
    };

    const first = await service.uploadImage("novelai", input);
    clock.timestamp = Date.parse("2026-08-21T15:00:00.000Z");
    const second = await service.uploadImage("novelai", {
      ...input,
      body: streamFromText(IMAGE_BODY),
    });

    expect(repository.records.get(first.parentId)?.name).toBe("2026-08-21");
    expect(repository.records.get(second.parentId)?.name).toBe("2026-08-22");
    expect(first.name).toBe("23-59-59-999_first-name.png");
    expect(second.name).toBe("00-00-00-000_second-name.png");
  });

  it("keeps the NovelAI MIME error and uses the generic error elsewhere", async () => {
    const novelAi = createService([]).service;
    const custom = createService([], profileWith({ id: "capture" })).service;
    const input = {
      contentType: "text/plain",
      declaredSize: 1,
      body: streamFromText("x"),
    };

    await expect(novelAi.uploadImage("novelai", input)).rejects.toMatchObject({
      code: NOVELAI_ERRORS.UNSUPPORTED_IMAGE_TYPE.code,
    });
    await expect(custom.uploadImage("capture", input)).rejects.toMatchObject({
      code: IMAGE_UPLOAD_ERRORS.UNSUPPORTED_IMAGE_TYPE.code,
    });
  });

  it("cleans pending metadata after storage failure", async () => {
    const { repository, storage, service } = createService([
      "name-id",
      "novelai-directory",
      "date-directory",
      "file-id",
    ]);
    storage.failOnPut = true;

    await expect(
      service.uploadImage("novelai", {
        contentType: IMAGE_UPLOAD_CONTENT_TYPE.PNG,
        declaredSize: IMAGE_BODY.length,
        body: streamFromText(IMAGE_BODY),
      }),
    ).rejects.toThrow("Storage failure");
    expect(repository.records.has("file-id")).toBe(false);
  });

  it("delegates body validation to the shared file service", async () => {
    const { service } = createService([
      "name-id",
      "novelai-directory",
      "date-directory",
      "file-id",
    ]);

    await expect(
      service.uploadImage("novelai", {
        contentType: IMAGE_UPLOAD_CONTENT_TYPE.PNG,
        declaredSize: 1,
        body: null,
      }),
    ).rejects.toMatchObject({ code: FILE_ERRORS.MISSING_FILE_BODY.code });
  });
});

function novelAiProfile(): ImageUploadProfile {
  return profileWith({
    id: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.ID,
    displayName: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.DISPLAY_NAME,
    rootId: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.ROOT_ID,
    pathTemplate: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.PATH_TEMPLATE,
    fileNameTemplate: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.FILE_NAME_TEMPLATE,
    enabled: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.ENABLED,
    contentTypes: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.CONTENT_TYPES,
  });
}

function profileWith(
  overrides: Partial<ImageUploadProfile>,
): ImageUploadProfile {
  return {
    id: "capture",
    displayName: "Capture",
    rootId: FILESYSTEM_ROOT_ID.DESKTOP,
    pathTemplate: "Capture/{yyyy-MM-dd}",
    fileNameTemplate: "{HH-mm-ss-SSS}_{uuid}.{ext}",
    enabled: true,
    contentTypes: [IMAGE_UPLOAD_CONTENT_TYPE.PNG],
    createdAt: new Date(KOREA_MIDNIGHT).toISOString(),
    updatedAt: new Date(KOREA_MIDNIGHT).toISOString(),
    ...overrides,
  };
}
