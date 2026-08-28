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

describe("computer-room filesystem transfer API", () => {
  it("uploads, downloads, moves to trash, restores, and permanently deletes a file", async () => {
    const content = "hello computer-room";
    const upload = await uploadFile("한글 문서.txt", content);
    expect(upload.status).toBe(HTTP_STATUS.CREATED);
    const created = (await upload.json()) as { file: { id: string; name: string } };
    expect(created.file.name).toBe("한글 문서.txt");

    const objectList = await env.FILES.list();
    expect(objectList.objects).toHaveLength(1);
    expect(objectList.objects[0]?.key).toBe(
      `${FILE_OBJECT_KEY_PREFIX}/${created.file.id}`,
    );

    const directoryQuery = new URLSearchParams({
      [API_QUERY_PARAMETERS.PARENT_ID]: FILESYSTEM_ROOT_ID.DOCUMENTS,
    });
    const list = await SELF.fetch(
      `${ORIGIN}${FILESYSTEM_API_PATHS.ENTRIES}?${directoryQuery}`,
    );
    const page = (await list.json()) as { items: Array<{ id: string; name: string }> };
    expect(page.items).toEqual([
      expect.objectContaining({ id: created.file.id, name: "한글 문서.txt" }),
    ]);

    const download = await SELF.fetch(
      `${ORIGIN}${FILESYSTEM_API_PATHS.FILES}/${created.file.id}/${API_PATH_SEGMENTS.DOWNLOAD}`,
    );
    expect(download.status).toBe(HTTP_STATUS.OK);
    expect(download.headers.get(HTTP_HEADERS.CONTENT_DISPOSITION)).toContain(
      "filename*=UTF-8''",
    );
    await expect(download.text()).resolves.toBe(content);

    const deletion = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.ENTRIES}/${created.file.id}`, {
      method: HTTP_METHOD.DELETE,
      headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
    });
    expect(deletion.status).toBe(HTTP_STATUS.OK);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM files").first("count")).toBe(1);
    expect((await env.FILES.list()).objects).toHaveLength(1);

    const trashPath = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.TRASH}`;
    const trash = await SELF.fetch(`${ORIGIN}${trashPath}`);
    const trashPage = (await trash.json()) as { items: Array<{ entry: { id: string } }> };
    expect(trashPage.items[0]?.entry.id).toBe(created.file.id);

    const restore = await SELF.fetch(
      `${ORIGIN}${trashPath}/${created.file.id}/${API_PATH_SEGMENTS.RESTORE}`,
      { method: HTTP_METHOD.POST, headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN } },
    );
    expect(restore.status).toBe(HTTP_STATUS.OK);
    await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.ENTRIES}/${created.file.id}`, {
      method: HTTP_METHOD.DELETE,
      headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
    });
    const permanentDeletion = await SELF.fetch(
      `${ORIGIN}${trashPath}/${created.file.id}`,
      { method: HTTP_METHOD.DELETE, headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN } },
    );
    expect(permanentDeletion.status).toBe(HTTP_STATUS.NO_CONTENT);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM files").first("count")).toBe(0);
    expect((await env.FILES.list()).objects).toHaveLength(0);
  });

  it("numbers duplicate names while keeping different object keys", async () => {
    expect((await uploadFile("same.txt", "first")).status).toBe(
      HTTP_STATUS.CREATED,
    );
    expect((await uploadFile("same.txt", "second")).status).toBe(
      HTTP_STATUS.CREATED,
    );

    const query = new URLSearchParams({
      [API_QUERY_PARAMETERS.PARENT_ID]: FILESYSTEM_ROOT_ID.DOCUMENTS,
    });
    const list = await SELF.fetch(
      `${ORIGIN}${FILESYSTEM_API_PATHS.ENTRIES}?${query}`,
    );
    const page = (await list.json()) as { items: Array<{ id: string; name: string }> };
    expect(page.items).toHaveLength(2);
    expect(page.items.map((file) => file.name).sort()).toEqual([
      "same (2).txt",
      "same.txt",
    ]);
    expect(new Set(page.items.map((file) => file.id)).size).toBe(2);
  });

  it("rejects oversized and cross-origin uploads before persistence", async () => {
    const oversized = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.FILES}?name=large.bin`, {
      method: HTTP_METHOD.POST,
      headers: {
        [HTTP_HEADERS.CONTENT_TYPE]: DEFAULT_CONTENT_TYPE,
        [HTTP_HEADERS.FILE_SIZE]: String(MAX_FILE_SIZE_BYTES + 1),
        [HTTP_HEADERS.ORIGIN]: ORIGIN,
      },
      body: "x",
    });
    expect(oversized.status).toBe(HTTP_STATUS.CONTENT_TOO_LARGE);

    const crossOrigin = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.FILES}?name=file.txt`, {
      method: HTTP_METHOD.POST,
      headers: {
        [HTTP_HEADERS.CONTENT_TYPE]: TEST_MEDIA_TYPE.TEXT,
        [HTTP_HEADERS.FILE_SIZE]: "1",
        [HTTP_HEADERS.ORIGIN]: "https://attacker.example",
      },
      body: "x",
    });
    expect(crossOrigin.status).toBe(HTTP_STATUS.FORBIDDEN);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM files").first("count")).toBe(0);
  });

  it("returns route-not-found for every removed legacy file route", async () => {
    const legacyPath = "/api/files";
    const responses = await Promise.all([
      SELF.fetch(`${ORIGIN}${legacyPath}`),
      SELF.fetch(`${ORIGIN}${legacyPath}`, {
        method: HTTP_METHOD.POST,
        headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
      }),
      SELF.fetch(`${ORIGIN}${legacyPath}/file-id`, {
        method: HTTP_METHOD.DELETE,
        headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
      }),
      SELF.fetch(`${ORIGIN}${legacyPath}/file-id/download`),
      SELF.fetch(`${ORIGIN}${legacyPath}/file-id/content`),
      SELF.fetch(`${ORIGIN}${legacyPath}/file-id/thumbnail`),
    ]);

    expect(responses.map((response) => response.status)).toEqual(
      Array.from({ length: responses.length }, () => HTTP_STATUS.NOT_FOUND),
    );
  });
});
