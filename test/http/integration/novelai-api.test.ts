import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  API_PATHS,
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
  FILESYSTEM_API_PATHS,
  MOBILE_PREFERENCES_API_PATH,
  NOVELAI_IMAGE_UPLOAD_API_PATH,
} from "@/constants/platform/api";
import { ACCESS_LOGOUT_PATH } from "@/constants/platform/auth";
import { CHECKLIST_EVENT_ACTION } from "@/constants/widgets/checklist";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { MOBILE_PREFERENCES_ERRORS } from "@/constants/platform/errors/mobile-preferences";
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
import {
  DEFAULT_FILESYSTEM_DIRECTORY_SORT,
  FILESYSTEM_SORT_DIRECTION,
  FILESYSTEM_SORT_FIELD,
} from "@/constants/filesystem/sort";
import {
  HTTP_HEADERS,
  HTTP_MEDIA_TYPE,
  HTTP_METHOD,
  HTTP_STATUS,
} from "@/constants/platform/http";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import { NOVELAI_STORAGE_PATH } from "@/constants/integrations/novelai";
import { THUMBNAIL_SPEC } from "@/constants/filesystem/thumbnail";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import { thumbnailObjectKey } from "@/domain/filesystem/thumbnail";
import type { DashboardWidget, WidgetLayout, WidgetType } from "@/types/widgets/widget";
import type { StorageStatusSnapshot } from "@/types/storage/storage-status";
import type { FilesystemDirectoryDetails } from "@/types/filesystem/directory-details";
import {
  MEMO_WINDOW_POLICY,
  ONE_PIXEL_PNG_BASE64,
  ORIGIN,
  TEST_MEDIA_TYPE,
  checklistPath,
  createWidget,
  decodeResponseBody,
  discardWidget,
  jsonRequest,
  resetWorkerState,
  saveWidgets,
  toLayout,
  uploadFile,
  uploadNovelAiImage,
  widgetPath,
} from "@test/support/http/worker-api-harness";

beforeEach(resetWorkerState);

describe("computer-room NovelAI API", () => {
  it("stores concurrent NovelAI images in one Korea-date desktop path", async () => {
    const [firstResponse, secondResponse] = await Promise.all([
      uploadNovelAiImage(
        "first-image",
        TEST_MEDIA_TYPE.IMAGE,
        new URLSearchParams({
          [API_QUERY_PARAMETERS.FILE_NAME]: "caller-name.png",
          [API_QUERY_PARAMETERS.PARENT_ID]: FILESYSTEM_ROOT_ID.DOCUMENTS,
        }),
      ),
      uploadNovelAiImage("second-image"),
    ]);
    expect(firstResponse.status).toBe(HTTP_STATUS.CREATED);
    expect(secondResponse.status).toBe(HTTP_STATUS.CREATED);
    const first = (await firstResponse.json()) as {
      file: { id: string; name: string; parentId: string };
    };
    const second = (await secondResponse.json()) as {
      file: { id: string; name: string; parentId: string };
    };

    expect(first.file.id).not.toBe(second.file.id);
    expect(first.file.name).not.toBe(second.file.name);
    expect(first.file.name).toMatch(
      /^\d{2}-\d{2}-\d{2}-\d{3}_[0-9a-f-]+\.png$/u,
    );
    const baseDirectories = await env.DB.prepare(
      `SELECT id, parent_id, name FROM filesystem_entries
       WHERE parent_id = ?1 AND name_key = ?2 AND trashed_at IS NULL`,
    )
      .bind(
        FILESYSTEM_ROOT_ID.DESKTOP,
        filesystemNameKey(NOVELAI_STORAGE_PATH.DIRECTORY_NAME),
      )
      .all<{ id: string; parent_id: string; name: string }>();
    expect(baseDirectories.results).toHaveLength(1);
    expect(baseDirectories.results[0]?.name).toBe(
      NOVELAI_STORAGE_PATH.DIRECTORY_NAME,
    );
    const baseDirectoryId = baseDirectories.results[0]?.id;
    expect(baseDirectoryId).toBeTruthy();
    const dateDirectories = await env.DB.prepare(
      `SELECT id, name FROM filesystem_entries
       WHERE parent_id = ?1 AND kind = ?2 AND trashed_at IS NULL`,
    )
      .bind(baseDirectoryId, FILESYSTEM_ENTRY_KIND.DIRECTORY)
      .all<{ id: string; name: string }>();
    expect(dateDirectories.results).toHaveLength(1);
    expect(dateDirectories.results[0]?.name).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(first.file.parentId).toBe(dateDirectories.results[0]?.id);
    expect(second.file.parentId).toBe(dateDirectories.results[0]?.id);

    const objects = await env.FILES.list();
    expect(objects.objects).toHaveLength(2);
    const firstObject = await env.FILES.get(
      `${FILE_OBJECT_KEY_PREFIX}/${first.file.id}`,
    );
    const secondObject = await env.FILES.get(
      `${FILE_OBJECT_KEY_PREFIX}/${second.file.id}`,
    );
    expect(firstObject).not.toBeNull();
    expect(secondObject).not.toBeNull();
    await expect(new Response(firstObject!.body).text()).resolves.toBe(
      "first-image",
    );
    await expect(new Response(secondObject!.body).text()).resolves.toBe(
      "second-image",
    );
  });

  it("validates the NovelAI upload method, media type, size, and fixed path", async () => {
    const wrongMethod = await SELF.fetch(
      `${ORIGIN}${NOVELAI_IMAGE_UPLOAD_API_PATH}`,
    );
    expect(wrongMethod.status).toBe(HTTP_STATUS.METHOD_NOT_ALLOWED);

    const unsupported = await uploadNovelAiImage(
      "text",
      TEST_MEDIA_TYPE.TEXT,
    );
    expect(unsupported.status).toBe(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE);

    const missingSize = await SELF.fetch(
      `${ORIGIN}${NOVELAI_IMAGE_UPLOAD_API_PATH}`,
      {
        method: HTTP_METHOD.POST,
        headers: { [HTTP_HEADERS.CONTENT_TYPE]: TEST_MEDIA_TYPE.IMAGE },
        body: "image",
      },
    );
    expect(missingSize.status).toBe(HTTP_STATUS.BAD_REQUEST);

    const oversized = await SELF.fetch(
      `${ORIGIN}${NOVELAI_IMAGE_UPLOAD_API_PATH}?parentId=${FILESYSTEM_ROOT_ID.DOCUMENTS}`,
      {
        method: HTTP_METHOD.POST,
        headers: {
          [HTTP_HEADERS.CONTENT_TYPE]: TEST_MEDIA_TYPE.IMAGE,
          [HTTP_HEADERS.FILE_SIZE]: String(MAX_FILE_SIZE_BYTES + 1),
        },
        body: "x",
      },
    );
    expect(oversized.status).toBe(HTTP_STATUS.CONTENT_TOO_LARGE);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM files").first("count"),
    ).toBe(0);
  });

  it("rejects a NovelAI storage path occupied by a regular file", async () => {
    const occupied = await uploadFile(
      "NovelAI",
      "x",
      FILESYSTEM_ROOT_ID.DESKTOP,
    );
    expect(occupied.status).toBe(HTTP_STATUS.CREATED);

    const response = await uploadNovelAiImage("image");

    expect(response.status).toBe(HTTP_STATUS.CONFLICT);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe(
      FILESYSTEM_ERRORS.DIRECTORY_PATH_CONFLICT.code,
    );
    expect((await env.FILES.list()).objects).toHaveLength(1);
  });
});
