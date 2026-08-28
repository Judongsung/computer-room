import { describe, expect, it } from "vitest";
import {
  IMAGE_UPLOAD_CONTENT_TYPE,
  IMAGE_UPLOAD_PROFILE_LIMITS,
} from "@/constants/integrations/image-upload-profile";
import { IMAGE_UPLOAD_PROFILE_ERRORS } from "@/constants/integrations/errors/image-upload-profile";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import {
  normalizeImageUploadProfileConfiguration,
  normalizeImageUploadProfileId,
  renderImageUploadFileNameTemplate,
  renderImageUploadPathTemplate,
} from "@/domain/integrations/image-upload-profile";

const VALID_CONFIGURATION = {
  displayName: "  테스트   프로필  ",
  rootId: FILESYSTEM_ROOT_ID.DOCUMENTS,
  pathTemplate: " Images /{profileId}/{yyyy-MM-dd}",
  fileNameTemplate: "{profileId}_{HH-mm-ss-SSS}_{uuid}.{ext}",
  enabled: true,
  contentTypes: [IMAGE_UPLOAD_CONTENT_TYPE.PNG, IMAGE_UPLOAD_CONTENT_TYPE.JPEG],
} as const;

describe("image upload profile", () => {
  it("normalizes a valid profile and keeps supported MIME order", () => {
    expect(
      normalizeImageUploadProfileConfiguration("my-profile", VALID_CONFIGURATION),
    ).toEqual({
      ...VALID_CONFIGURATION,
      displayName: "테스트 프로필",
      pathTemplate: "Images/{profileId}/{yyyy-MM-dd}",
      contentTypes: [IMAGE_UPLOAD_CONTENT_TYPE.JPEG, IMAGE_UPLOAD_CONTENT_TYPE.PNG],
    });
  });

  it.each([
    "",
    "UPPER",
    "-leading",
    "trailing-",
    "with_underscore",
    "a".repeat(IMAGE_UPLOAD_PROFILE_LIMITS.ID_MAX_LENGTH + 1),
  ])("rejects invalid profile ID %j", (id) => {
    expect(() => normalizeImageUploadProfileId(id)).toThrowError(
      expect.objectContaining({ code: IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_ID.code }),
    );
  });

  it.each([
    "a//b",
    "../images",
    "folder\\images",
    "{uuid}",
    `${Array.from({ length: IMAGE_UPLOAD_PROFILE_LIMITS.MAX_PATH_SEGMENTS + 1 }, () => "a").join("/")}`,
  ])("rejects invalid path template %j", (pathTemplate) => {
    expect(() =>
      normalizeImageUploadProfileConfiguration("profile", {
        ...VALID_CONFIGURATION,
        pathTemplate,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_PATH_TEMPLATE.code,
      }),
    );
  });

  it.each([
    "{uuid}.png",
    "name.{ext}",
    "{uuid}_{uuid}.{ext}",
    "{uuid}.{ext}.{ext}",
    "{unsupported}_{uuid}.{ext}",
    "folder/{uuid}.{ext}",
  ])("rejects invalid file name template %j", (fileNameTemplate) => {
    expect(() =>
      normalizeImageUploadProfileConfiguration("profile", {
        ...VALID_CONFIGURATION,
        fileNameTemplate,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_FILE_NAME_TEMPLATE.code,
      }),
    );
  });

  it("requires at least one supported image MIME", () => {
    for (const contentTypes of [[], ["image/tiff"]]) {
      expect(() =>
        normalizeImageUploadProfileConfiguration("profile", {
          ...VALID_CONFIGURATION,
          contentTypes,
        }),
      ).toThrowError(
        expect.objectContaining({
          code: IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_CONTENT_TYPES.code,
        }),
      );
    }
  });

  it("renders path and file name tokens from one context", () => {
    const context = {
      profileId: "pixiv",
      businessDate: "2026-08-28",
      koreaTime: "23-59-58-123",
      uuid: "00000000-0000-4000-8000-000000000001",
      extension: "webp",
    };
    expect(
      renderImageUploadPathTemplate("{profileId}/{yyyy-MM-dd}", context),
    ).toEqual(["pixiv", "2026-08-28"]);
    expect(
      renderImageUploadFileNameTemplate(
        "{HH-mm-ss-SSS}_{uuid}.{ext}",
        context,
      ),
    ).toBe("23-59-58-123_00000000-0000-4000-8000-000000000001.webp");
  });
});
