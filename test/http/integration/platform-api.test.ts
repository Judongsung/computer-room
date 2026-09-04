import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { API_PATHS, API_PATH_SEGMENTS, FILESYSTEM_API_PATHS, MOBILE_PREFERENCES_API_PATH } from "@/constants/platform/api";
import {
  ACCESS_LOGIN_PATH,
  ACCESS_LOGOUT_PATH,
  ACCESS_MODE_OWNER_VALUE,
  ACCESS_MODE_QUERY_PARAMETER,
} from "@/constants/platform/auth";
import { MOBILE_PREFERENCES_ERRORS } from "@/constants/platform/errors/mobile-preferences";
import { MAX_FILE_SIZE_BYTES } from "@/constants/filesystem/file";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import {
  HTTP_HEADERS,
  HTTP_MEDIA_TYPE,
  HTTP_METHOD,
  HTTP_STATUS,
} from "@/constants/platform/http";
import { ORIGIN, TEST_MEDIA_TYPE, jsonRequest, resetWorkerState, uploadFile } from "@test/support/http/worker-api-harness";

beforeEach(resetWorkerState);

describe("computer-room platform API", () => {
  it("returns the local session", async () => {
    const response = await SELF.fetch(`${ORIGIN}${API_PATHS.SESSION}`);

    expect(response.status).toBe(HTTP_STATUS.OK);
    await expect(response.json()).resolves.toEqual({
      email: "owner@example.com",
      logoutUrl: ACCESS_LOGOUT_PATH,
      filePolicy: {
        maxUploadSizeBytes: MAX_FILE_SIZE_BYTES,
      },
    });
  });

  it("turns a protected login route into a short-lived owner hint", async () => {
    const response = await SELF.fetch(`${ORIGIN}${ACCESS_LOGIN_PATH}`, {
      redirect: "manual",
    });

    expect(response.status).toBe(HTTP_STATUS.FOUND);
    const location = new URL(
      response.headers.get(HTTP_HEADERS.LOCATION) ?? "",
    );
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get(ACCESS_MODE_QUERY_PARAMETER)).toBe(
      ACCESS_MODE_OWNER_VALUE,
    );
  });

  it("stores one shared mobile wallpaper and clears it with a trashed subtree", async () => {
    const initialResponse = await SELF.fetch(
      `${ORIGIN}${MOBILE_PREFERENCES_API_PATH}`,
    );
    expect(initialResponse.status).toBe(HTTP_STATUS.OK);
    expect(initialResponse.headers.get(HTTP_HEADERS.CACHE_CONTROL)).toBe(
      "private, no-store",
    );
    await expect(initialResponse.json()).resolves.toEqual({
      preferences: { wallpaper: null },
    });

    const imageUpload = await uploadFile(
      "mobile-wallpaper.png",
      "image",
      undefined,
      TEST_MEDIA_TYPE.IMAGE,
    );
    const image = (await imageUpload.json()) as {
      file: { id: string; parentId: string; name: string };
    };
    const missingOrigin = await SELF.fetch(
      `${ORIGIN}${MOBILE_PREFERENCES_API_PATH}`,
      {
        method: HTTP_METHOD.PATCH,
        headers: { [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON },
        body: JSON.stringify({ wallpaperFileId: image.file.id }),
      },
    );
    expect(missingOrigin.status).toBe(HTTP_STATUS.FORBIDDEN);

    const selected = await jsonRequest(
      MOBILE_PREFERENCES_API_PATH,
      HTTP_METHOD.PATCH,
      { wallpaperFileId: image.file.id },
    );
    expect(selected.status).toBe(HTTP_STATUS.OK);
    await expect(selected.json()).resolves.toMatchObject({
      preferences: { wallpaper: { id: image.file.id, name: image.file.name } },
    });

    const directoryResponse = await jsonRequest(
      FILESYSTEM_API_PATHS.DIRECTORIES,
      HTTP_METHOD.POST,
      { parentId: FILESYSTEM_ROOT_ID.DOCUMENTS, name: "배경 보관함" },
    );
    const directory = (await directoryResponse.json()) as {
      directory: { id: string };
    };
    expect(directoryResponse.status).toBe(HTTP_STATUS.CREATED);
    expect(
      (
        await jsonRequest(
          `${FILESYSTEM_API_PATHS.ENTRIES}/${image.file.id}/${API_PATH_SEGMENTS.MOVE}`,
          HTTP_METHOD.POST,
          { parentId: directory.directory.id },
        )
      ).status,
    ).toBe(HTTP_STATUS.OK);

    const movedPreferences = await SELF.fetch(
      `${ORIGIN}${MOBILE_PREFERENCES_API_PATH}`,
    );
    await expect(movedPreferences.json()).resolves.toMatchObject({
      preferences: {
        wallpaper: {
          id: image.file.id,
          parentId: directory.directory.id,
        },
      },
    });

    const trashedDirectory = await SELF.fetch(
      `${ORIGIN}${FILESYSTEM_API_PATHS.ENTRIES}/${directory.directory.id}`,
      {
        method: HTTP_METHOD.DELETE,
        headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
      },
    );
    expect(trashedDirectory.status).toBe(HTTP_STATUS.OK);
    expect(
      await env.DB
        .prepare(
          "SELECT wallpaper_entry_id FROM mobile_preferences WHERE singleton_id = 1",
        )
        .first("wallpaper_entry_id"),
    ).toBeNull();

    const restoredDirectory = await jsonRequest(
      `${FILESYSTEM_API_PATHS.TRASH}/${directory.directory.id}/${API_PATH_SEGMENTS.RESTORE}`,
      HTTP_METHOD.POST,
      {},
    );
    expect(restoredDirectory.status).toBe(HTTP_STATUS.OK);
    const afterRestore = await SELF.fetch(
      `${ORIGIN}${MOBILE_PREFERENCES_API_PATH}`,
    );
    await expect(afterRestore.json()).resolves.toEqual({
      preferences: { wallpaper: null },
    });

    const secondUpload = await uploadFile(
      "second-wallpaper.webp",
      "image-two",
      undefined,
      "image/webp",
    );
    const second = (await secondUpload.json()) as { file: { id: string } };
    expect(
      (
        await jsonRequest(
          MOBILE_PREFERENCES_API_PATH,
          HTTP_METHOD.PATCH,
          { wallpaperFileId: second.file.id },
        )
      ).status,
    ).toBe(HTTP_STATUS.OK);
    expect(
      (
        await jsonRequest(
          FILESYSTEM_API_PATHS.BATCH_TRASH,
          HTTP_METHOD.POST,
          { entryIds: [second.file.id] },
        )
      ).status,
    ).toBe(HTTP_STATUS.OK);
    expect(
      await env.DB
        .prepare(
          "SELECT wallpaper_entry_id FROM mobile_preferences WHERE singleton_id = 1",
        )
        .first("wallpaper_entry_id"),
    ).toBeNull();
  });

  it("rejects invalid mobile wallpaper selections", async () => {
    const textUpload = await uploadFile("notes.txt", "notes");
    const textFile = (await textUpload.json()) as { file: { id: string } };
    const unsupported = await jsonRequest(
      MOBILE_PREFERENCES_API_PATH,
      HTTP_METHOD.PATCH,
      { wallpaperFileId: textFile.file.id },
    );
    expect(unsupported.status).toBe(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE);
    await expect(unsupported.json()).resolves.toEqual({
      error: {
        code: MOBILE_PREFERENCES_ERRORS.WALLPAPER_FILE_TYPE_NOT_SUPPORTED.code,
        message:
          MOBILE_PREFERENCES_ERRORS.WALLPAPER_FILE_TYPE_NOT_SUPPORTED.message,
      },
    });

    const missing = await jsonRequest(
      MOBILE_PREFERENCES_API_PATH,
      HTTP_METHOD.PATCH,
      { wallpaperFileId: "missing-wallpaper" },
    );
    expect(missing.status).toBe(HTTP_STATUS.NOT_FOUND);
    const cleared = await jsonRequest(
      MOBILE_PREFERENCES_API_PATH,
      HTTP_METHOD.PATCH,
      { wallpaperFileId: null },
    );
    expect(cleared.status).toBe(HTTP_STATUS.OK);
    await expect(cleared.json()).resolves.toEqual({
      preferences: { wallpaper: null },
    });
  });
});
