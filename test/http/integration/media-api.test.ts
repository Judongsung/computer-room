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

describe("computer-room media API", () => {
  it("streams supported media with single byte ranges", async () => {
    const body = "0123456789";
    const upload = await uploadFile(
      "clip.mp4",
      body,
      undefined,
      TEST_MEDIA_TYPE.VIDEO,
    );
    const created = (await upload.json()) as { file: { id: string } };
    const contentPath = `${ORIGIN}${FILESYSTEM_API_PATHS.FILES}/${created.file.id}/${API_PATH_SEGMENTS.CONTENT}`;

    const full = await SELF.fetch(contentPath);
    expect(full.status).toBe(HTTP_STATUS.OK);
    expect(full.headers.get(HTTP_HEADERS.ACCEPT_RANGES)).toBe("bytes");
    expect(full.headers.get(HTTP_HEADERS.CONTENT_DISPOSITION)).toContain("inline");
    await expect(decodeResponseBody(full)).resolves.toBe(body);

    const partial = await SELF.fetch(contentPath, {
      headers: { [HTTP_HEADERS.RANGE]: "bytes=2-5" },
    });
    expect(partial.status).toBe(HTTP_STATUS.PARTIAL_CONTENT);
    expect(partial.headers.get(HTTP_HEADERS.CONTENT_RANGE)).toBe("bytes 2-5/10");
    expect(partial.headers.get(HTTP_HEADERS.CONTENT_LENGTH)).toBe("4");
    await expect(decodeResponseBody(partial)).resolves.toBe("2345");

    const suffix = await SELF.fetch(contentPath, {
      headers: { [HTTP_HEADERS.RANGE]: "bytes=-3" },
    });
    expect(suffix.status).toBe(HTTP_STATUS.PARTIAL_CONTENT);
    expect(suffix.headers.get(HTTP_HEADERS.CONTENT_RANGE)).toBe("bytes 7-9/10");
    await expect(decodeResponseBody(suffix)).resolves.toBe("789");

    const invalid = await SELF.fetch(contentPath, {
      headers: { [HTTP_HEADERS.RANGE]: "bytes=0-1,4-5" },
    });
    expect(invalid.status).toBe(HTTP_STATUS.RANGE_NOT_SATISFIABLE);
    expect(invalid.headers.get(HTTP_HEADERS.CONTENT_RANGE)).toBe("bytes */10");
    expect(invalid.headers.get(HTTP_HEADERS.ACCEPT_RANGES)).toBe("bytes");
  });

  it("does not expose unsupported files through the inline content route", async () => {
    const upload = await uploadFile("notes.txt", "notes");
    const created = (await upload.json()) as { file: { id: string } };
    const response = await SELF.fetch(
      `${ORIGIN}${FILESYSTEM_API_PATHS.FILES}/${created.file.id}/${API_PATH_SEGMENTS.CONTENT}`,
    );
    expect(response.status).toBe(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE);
  });

  it("generates, caches, serves, and permanently deletes image thumbnails", async () => {
    const imageBytes = Uint8Array.from(
      atob(ONE_PIXEL_PNG_BASE64),
      (character) => character.charCodeAt(0),
    );
    const query = new URLSearchParams({
      [API_QUERY_PARAMETERS.FILE_NAME]: "pixel.png",
    });
    const upload = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.FILES}?${query}`, {
      method: HTTP_METHOD.POST,
      headers: {
        [HTTP_HEADERS.CONTENT_TYPE]: TEST_MEDIA_TYPE.IMAGE,
        [HTTP_HEADERS.FILE_SIZE]: String(imageBytes.byteLength),
        [HTTP_HEADERS.ORIGIN]: ORIGIN,
      },
      body: imageBytes,
    });
    expect(upload.status).toBe(HTTP_STATUS.CREATED);
    const created = (await upload.json()) as { file: { id: string } };
    const thumbnailPath = `${ORIGIN}${FILESYSTEM_API_PATHS.FILES}/${created.file.id}/${API_PATH_SEGMENTS.THUMBNAIL}`;
    const thumbnailKey = thumbnailObjectKey(created.file.id);

    const first = await SELF.fetch(thumbnailPath);
    expect(first.status).toBe(HTTP_STATUS.OK);
    expect(first.headers.get(HTTP_HEADERS.CONTENT_TYPE)).toBe(
      THUMBNAIL_SPEC.OUTPUT_CONTENT_TYPE,
    );
    expect(first.headers.get(HTTP_HEADERS.CACHE_CONTROL)).toContain("immutable");
    expect((await first.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect((await env.FILES.list()).objects.map((object) => object.key)).toContain(
      thumbnailKey,
    );

    const second = await SELF.fetch(thumbnailPath);
    expect(second.status).toBe(HTTP_STATUS.OK);
    expect((await env.FILES.list()).objects).toHaveLength(2);

    await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.ENTRIES}/${created.file.id}`, {
      method: HTTP_METHOD.DELETE,
      headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
    });
    expect((await SELF.fetch(thumbnailPath)).status).toBe(HTTP_STATUS.OK);

    const trashPath = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.TRASH}`;
    const deletion = await SELF.fetch(
      `${ORIGIN}${trashPath}/${created.file.id}`,
      {
        method: HTTP_METHOD.DELETE,
        headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
      },
    );
    expect(deletion.status).toBe(HTTP_STATUS.NO_CONTENT);
    expect((await env.FILES.list()).objects).toHaveLength(0);
  });

  it("does not serve thumbnails for files outside every system root", async () => {
    const entryId = "orphaned-image";
    const objectKey = `${FILE_OBJECT_KEY_PREFIX}/${entryId}`;
    const imageBytes = Uint8Array.from(
      atob(ONE_PIXEL_PNG_BASE64),
      (character) => character.charCodeAt(0),
    );
    await env.FILES.put(objectKey, imageBytes, {
      httpMetadata: { contentType: TEST_MEDIA_TYPE.IMAGE },
    });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO files (
           id, object_key, original_name, content_type, size, etag, status, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      ).bind(
        entryId,
        objectKey,
        "orphaned.png",
        TEST_MEDIA_TYPE.IMAGE,
        imageBytes.byteLength,
        "orphaned-etag",
        FILE_STATUS.READY,
        0,
      ),
      env.DB.prepare(
        `INSERT INTO filesystem_entries (
           id, parent_id, kind, name, name_key, file_id, widget_id,
           restore_parent_id, restore_path, trashed_at, created_at, updated_at
         ) VALUES (?1, NULL, ?2, ?3, ?4, ?1, NULL, NULL, NULL, NULL, 0, 0)`,
      ).bind(
        entryId,
        FILESYSTEM_ENTRY_KIND.FILE,
        "orphaned.png",
        filesystemNameKey("orphaned.png"),
      ),
    ]);

    const response = await SELF.fetch(
      `${ORIGIN}${FILESYSTEM_API_PATHS.FILES}/${entryId}/${API_PATH_SEGMENTS.THUMBNAIL}`,
    );

    expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect((await env.FILES.list()).objects).toHaveLength(1);
  });
});
