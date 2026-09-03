import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_QUERY_PARAMETERS,
  IMAGE_UPLOAD_LOGS_API_PATH,
  IMAGE_UPLOAD_LOG_SETTINGS_API_PATH,
} from "@/constants/platform/api";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { IMAGE_UPLOAD_LOG_OUTCOME } from "@/constants/integrations/image-upload-log";
import { HTTP_HEADERS, HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import type { ImageUploadLogResponse } from "@/types/integrations/image-upload-log";
import {
  ORIGIN,
  TEST_MEDIA_TYPE,
  jsonRequest,
  resetWorkerState,
  uploadNovelAiImage,
} from "@test/support/http/worker-api-harness";

beforeEach(resetWorkerState);

describe("image upload log API", () => {
  it("records authenticated image success and application failures", async () => {
    const successResponse = await uploadNovelAiImage("image");
    const failureResponse = await uploadNovelAiImage(
      "text",
      TEST_MEDIA_TYPE.TEXT,
    );
    expect(successResponse.status).toBe(HTTP_STATUS.CREATED);
    expect(failureResponse.status).toBe(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE);

    await vi.waitFor(async () => {
      const count = await env.DB
        .prepare("SELECT COUNT(*) AS count FROM integration_image_upload_logs")
        .first<number>("count");
      expect(count).toBe(2);
    });

    const response = await SELF.fetch(`${ORIGIN}${IMAGE_UPLOAD_LOGS_API_PATH}`);
    expect(response.status).toBe(HTTP_STATUS.OK);
    expect(response.headers.get(HTTP_HEADERS.CACHE_CONTROL)).toBe(
      "private, no-store",
    );
    const page = (await response.json()) as ImageUploadLogResponse;
    expect(page.items).toHaveLength(2);
    expect(page.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profileId: "novelai",
          sourceIp: "203.0.113.8",
          outcome: IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS,
          file: expect.objectContaining({ name: expect.stringMatching(/\.png$/u) }),
          error: null,
        }),
        expect.objectContaining({
          profileId: "novelai",
          sourceIp: "203.0.113.8",
          outcome: IMAGE_UPLOAD_LOG_OUTCOME.FAILURE,
          file: null,
          httpStatus: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
          error: expect.objectContaining({ code: expect.any(String) }),
        }),
      ]),
    );
  });

  it("filters logs and stops exposing a file after it leaves active roots", async () => {
    const upload = await uploadNovelAiImage("image");
    const uploaded = (await upload.json()) as { file: { id: string } };
    await vi.waitFor(async () => {
      expect(
        await env.DB
          .prepare("SELECT COUNT(*) AS count FROM integration_image_upload_logs")
          .first<number>("count"),
      ).toBe(1);
    });

    await env.DB
      .prepare(
        `UPDATE filesystem_entries
         SET parent_id = ?2, trashed_at = ?3
         WHERE id = ?1`,
      )
      .bind(uploaded.file.id, FILESYSTEM_ROOT_ID.RECYCLE_BIN, Date.now())
      .run();
    const query = new URLSearchParams({
      [API_QUERY_PARAMETERS.PROFILE_ID]: "novelai",
      [API_QUERY_PARAMETERS.OUTCOME]: IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS,
    });
    const response = await SELF.fetch(
      `${ORIGIN}${IMAGE_UPLOAD_LOGS_API_PATH}?${query}`,
    );
    const page = (await response.json()) as ImageUploadLogResponse;

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      fileName: expect.stringMatching(/\.png$/u),
      file: null,
    });
  });

  it("validates filters and permits only GET", async () => {
    const invalid = await SELF.fetch(
      `${ORIGIN}${IMAGE_UPLOAD_LOGS_API_PATH}?${API_QUERY_PARAMETERS.OUTCOME}=unknown`,
    );
    expect(invalid.status).toBe(HTTP_STATUS.BAD_REQUEST);

    const wrongMethod = await SELF.fetch(
      `${ORIGIN}${IMAGE_UPLOAD_LOGS_API_PATH}`,
      {
        method: HTTP_METHOD.POST,
        headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
      },
    );
    expect(wrongMethod.status).toBe(HTTP_STATUS.METHOD_NOT_ALLOWED);
  });
});

describe("image upload log settings API", () => {
  it("reads the default and persists an owner setting", async () => {
    const initial = await SELF.fetch(
      `${ORIGIN}${IMAGE_UPLOAD_LOG_SETTINGS_API_PATH}`,
    );
    expect(initial.status).toBe(HTTP_STATUS.OK);
    expect(initial.headers.get(HTTP_HEADERS.CACHE_CONTROL)).toBe(
      "private, no-store",
    );
    await expect(initial.json()).resolves.toEqual({
      settings: { retentionDays: 30 },
    });

    const updated = await jsonRequest(
      IMAGE_UPLOAD_LOG_SETTINGS_API_PATH,
      HTTP_METHOD.PATCH,
      { retentionDays: 90 },
    );
    expect(updated.status).toBe(HTTP_STATUS.OK);
    await expect(updated.json()).resolves.toEqual({
      settings: { retentionDays: 90 },
    });
  });

  it.each([0, 1.5, 366, "30"])(
    "rejects invalid retention input: %s",
    async (retentionDays) => {
      const response = await jsonRequest(
        IMAGE_UPLOAD_LOG_SETTINGS_API_PATH,
        HTTP_METHOD.PATCH,
        { retentionDays },
      );
      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
    },
  );

  it("requires same-origin for changes and permits only GET and PATCH", async () => {
    const crossOrigin = await SELF.fetch(
      `${ORIGIN}${IMAGE_UPLOAD_LOG_SETTINGS_API_PATH}`,
      {
        method: HTTP_METHOD.PATCH,
        headers: { [HTTP_HEADERS.CONTENT_TYPE]: "application/json" },
        body: JSON.stringify({ retentionDays: 30 }),
      },
    );
    expect(crossOrigin.status).toBe(HTTP_STATUS.FORBIDDEN);

    const wrongMethod = await SELF.fetch(
      `${ORIGIN}${IMAGE_UPLOAD_LOG_SETTINGS_API_PATH}`,
      {
        method: HTTP_METHOD.POST,
        headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
      },
    );
    expect(wrongMethod.status).toBe(HTTP_STATUS.METHOD_NOT_ALLOWED);
  });
});
