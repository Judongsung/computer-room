import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE,
  IMAGE_UPLOAD_CONTENT_TYPE,
} from "@/constants/integrations/image-upload-profile";
import { IMAGE_UPLOAD_PROFILE_ERRORS } from "@/constants/integrations/errors/image-upload-profile";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { IMAGE_UPLOAD_PROFILES_API_PATH } from "@/constants/platform/api";
import {
  HTTP_HEADERS,
  HTTP_METHOD,
  HTTP_STATUS,
} from "@/constants/platform/http";
import {
  ORIGIN,
  jsonRequest,
  resetWorkerState,
} from "@test/support/http/worker-api-harness";

beforeEach(resetWorkerState);

const PROFILE_INPUT = {
  id: "capture",
  displayName: "Capture",
  rootId: FILESYSTEM_ROOT_ID.DOCUMENTS,
  pathTemplate: "Capture/{yyyy-MM-dd}",
  fileNameTemplate: "{HH-mm-ss-SSS}_{uuid}.{ext}",
  enabled: true,
  contentTypes: [IMAGE_UPLOAD_CONTENT_TYPE.PNG],
} as const;

describe("image upload profile API", () => {
  it("lists the seeded NovelAI profile and manages a custom profile", async () => {
    const initial = await SELF.fetch(`${ORIGIN}${IMAGE_UPLOAD_PROFILES_API_PATH}`);
    expect(initial.status).toBe(HTTP_STATUS.OK);
    expect(initial.headers.get(HTTP_HEADERS.CACHE_CONTROL)).toBe(
      "private, no-store",
    );
    await expect(initial.json()).resolves.toMatchObject({
      items: [
        {
          id: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.ID,
          pathTemplate: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.PATH_TEMPLATE,
          fileNameTemplate:
            DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.FILE_NAME_TEMPLATE,
          contentTypes: expect.arrayContaining(
            [...DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.CONTENT_TYPES],
          ),
        },
      ],
    });

    const creation = await jsonRequest(
      IMAGE_UPLOAD_PROFILES_API_PATH,
      HTTP_METHOD.POST,
      PROFILE_INPUT,
    );
    expect(creation.status).toBe(HTTP_STATUS.CREATED);
    await expect(creation.json()).resolves.toMatchObject({
      profile: PROFILE_INPUT,
    });

    const update = await jsonRequest(
      `${IMAGE_UPLOAD_PROFILES_API_PATH}/${PROFILE_INPUT.id}`,
      HTTP_METHOD.PUT,
      {
        displayName: "Changed",
        rootId: PROFILE_INPUT.rootId,
        pathTemplate: PROFILE_INPUT.pathTemplate,
        fileNameTemplate: PROFILE_INPUT.fileNameTemplate,
        enabled: false,
        contentTypes: PROFILE_INPUT.contentTypes,
      },
    );
    expect(update.status).toBe(HTTP_STATUS.OK);
    await expect(update.json()).resolves.toMatchObject({
      profile: { id: PROFILE_INPUT.id, displayName: "Changed", enabled: false },
    });

    const deletion = await SELF.fetch(
      `${ORIGIN}${IMAGE_UPLOAD_PROFILES_API_PATH}/${PROFILE_INPUT.id}`,
      {
        method: HTTP_METHOD.DELETE,
        headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
      },
    );
    expect(deletion.status).toBe(HTTP_STATUS.NO_CONTENT);
    expect(deletion.headers.get(HTTP_HEADERS.CACHE_CONTROL)).toBe(
      "private, no-store",
    );
  });

  it("enforces immutable IDs, validation, duplicate conflicts, and same origin", async () => {
    expect(
      (
        await jsonRequest(
          IMAGE_UPLOAD_PROFILES_API_PATH,
          HTTP_METHOD.POST,
          PROFILE_INPUT,
        )
      ).status,
    ).toBe(HTTP_STATUS.CREATED);

    const duplicate = await jsonRequest(
      IMAGE_UPLOAD_PROFILES_API_PATH,
      HTTP_METHOD.POST,
      PROFILE_INPUT,
    );
    expect(duplicate.status).toBe(HTTP_STATUS.CONFLICT);
    await expect(duplicate.json()).resolves.toMatchObject({
      error: { code: IMAGE_UPLOAD_PROFILE_ERRORS.ID_ALREADY_EXISTS.code },
    });

    const idChange = await jsonRequest(
      `${IMAGE_UPLOAD_PROFILES_API_PATH}/${PROFILE_INPUT.id}`,
      HTTP_METHOD.PUT,
      { ...PROFILE_INPUT, id: "changed" },
    );
    expect(idChange.status).toBe(HTTP_STATUS.BAD_REQUEST);

    const invalidTemplate = await jsonRequest(
      IMAGE_UPLOAD_PROFILES_API_PATH,
      HTTP_METHOD.POST,
      { ...PROFILE_INPUT, id: "invalid", fileNameTemplate: "{uuid}.png" },
    );
    expect(invalidTemplate.status).toBe(HTTP_STATUS.BAD_REQUEST);
    await expect(invalidTemplate.json()).resolves.toMatchObject({
      error: {
        code: IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_FILE_NAME_TEMPLATE.code,
      },
    });

    const crossOrigin = await SELF.fetch(
      `${ORIGIN}${IMAGE_UPLOAD_PROFILES_API_PATH}`,
      {
        method: HTTP_METHOD.POST,
        headers: {
          [HTTP_HEADERS.CONTENT_TYPE]: "application/json",
          [HTTP_HEADERS.ORIGIN]: "https://attacker.example",
        },
        body: JSON.stringify(PROFILE_INPUT),
      },
    );
    expect(crossOrigin.status).toBe(HTTP_STATUS.FORBIDDEN);
  });
});
