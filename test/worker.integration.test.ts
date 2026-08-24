import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  API_PATHS,
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
  FILESYSTEM_API_PATHS,
  NOVELAI_IMAGE_UPLOAD_API_PATH,
} from "@/constants/platform/api";
import { ACCESS_LOGOUT_PATH } from "@/constants/platform/auth";
import { CHECKLIST_EVENT_ACTION } from "@/constants/widgets/checklist";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
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

const ORIGIN = "http://localhost";
const TEST_MEDIA_TYPE = {
  IMAGE: "image/png",
  TEXT: "text/plain",
  VIDEO: "video/mp4",
} as const;
const MEMO_WINDOW_POLICY = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];
const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM filesystem_directory_preferences").run();
  await env.DB.prepare("DELETE FROM desktop_entry_order").run();
  await env.DB.prepare("DELETE FROM files").run();
  await env.DB
    .prepare("DELETE FROM filesystem_entries WHERE id NOT IN (?1, ?2, ?3)")
    .bind(
      FILESYSTEM_ROOT_ID.DESKTOP,
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      FILESYSTEM_ROOT_ID.RECYCLE_BIN,
    )
    .run();
  await env.DB.prepare("DELETE FROM dashboard_widgets").run();
  const objects = await env.FILES.list();
  if (objects.objects.length > 0) {
    await env.FILES.delete(objects.objects.map((object) => object.key));
  }
});

describe("computer-room Worker", () => {
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

  it("reports exact private R2 and D1 storage status without exposing object keys", async () => {
    await Promise.all([
      env.FILES.put("files/original-image", "abc", {
        httpMetadata: { contentType: "image/png; charset=binary" },
      }),
      env.FILES.put("thumbnails/original-image.webp", "de", {
        httpMetadata: { contentType: "image/webp" },
      }),
      env.FILES.put("managed/clip", "fghi", {
        httpMetadata: { contentType: "video/mp4" },
      }),
    ]);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO files(
        id, object_key, original_name, content_type, size, etag, status, created_at
      ) VALUES ('status-file', 'files/status-file', 'status.txt', 'text/plain', 4, 'etag', 'ready', 1)`),
      env.DB.prepare(`INSERT INTO filesystem_entries(
        id, parent_id, kind, name, name_key, file_id, widget_id,
        restore_parent_id, restore_path, trashed_at, created_at, updated_at
      ) VALUES
        ('status-directory', ?1, 'directory', 'status folder', 'status folder', NULL, NULL, NULL, NULL, NULL, 1, 1),
        ('status-file', 'status-directory', 'file', 'status.txt', 'status.txt', 'status-file', NULL, NULL, NULL, NULL, 1, 1),
        ('status-trash', ?2, 'directory', 'trash folder', 'trash folder', NULL, NULL, ?1, '바탕 화면', 1, 1, 1)`)
        .bind(FILESYSTEM_ROOT_ID.DESKTOP, FILESYSTEM_ROOT_ID.RECYCLE_BIN),
      env.DB.prepare(`INSERT INTO dashboard_widgets(
        id, type, position_x, position_y, width, height,
        window_state, restore_state, stack_order, is_open
      ) VALUES ('status-widget', 'storage-status', 32, 32, 560, 500, 'normal', 'normal', 0, 1)`),
    ]);

    const response = await SELF.fetch(`${ORIGIN}${API_PATHS.STORAGE_STATUS}`);
    const body = (await response.json()) as { status: StorageStatusSnapshot };

    expect(response.status).toBe(HTTP_STATUS.OK);
    expect(response.headers.get(HTTP_HEADERS.CACHE_CONTROL)).toBe("private, no-store");
    expect(body.status.r2.total).toEqual({ bytes: 9, objectCount: 3 });
    expect(body.status.r2.standard).toEqual({ bytes: 9, objectCount: 3 });
    expect(body.status.r2.byPurpose).toEqual({
      original: { bytes: 3, objectCount: 1 },
      thumbnail: { bytes: 2, objectCount: 1 },
      other: { bytes: 4, objectCount: 1 },
    });
    expect(body.status.r2.byMimeCategory.image).toEqual({ bytes: 5, objectCount: 2 });
    expect(body.status.r2.byMimeCategory.video).toEqual({ bytes: 4, objectCount: 1 });
    expect(body.status.d1).toEqual({
      databaseBytes: expect.any(Number),
      registeredFileCount: 1,
      directoryCount: 2,
      widgetCount: 1,
      trashItemCount: 1,
    });
    expect(body.status.d1.databaseBytes).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain("original-image");

    const wrongMethod = await jsonRequest(
      API_PATHS.STORAGE_STATUS,
      HTTP_METHOD.POST,
      {},
    );
    expect(wrongMethod.status).toBe(HTTP_STATUS.METHOD_NOT_ALLOWED);
  });

  it("creates the storage status widget once and reopens the same widget", async () => {
    const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.STORAGE_STATUS];
    const input = {
      type: WIDGET_TYPE.STORAGE_STATUS,
      position: { x: 32, y: 32 },
      size: {
        width: policy.DEFAULT_WIDTH,
        height: policy.DEFAULT_HEIGHT,
      },
    };
    const firstResponse = await jsonRequest(
      API_PATHS.WIDGETS,
      HTTP_METHOD.POST,
      input,
    );
    const first = (await firstResponse.json()) as { widget: DashboardWidget };
    expect(firstResponse.status).toBe(HTTP_STATUS.CREATED);

    const closeResponse = await jsonRequest(
      `${widgetPath(first.widget.id)}/${API_PATH_SEGMENTS.CLOSE}`,
      HTTP_METHOD.POST,
      {},
    );
    expect(closeResponse.status).toBe(HTTP_STATUS.NO_CONTENT);

    const secondResponse = await jsonRequest(
      API_PATHS.WIDGETS,
      HTTP_METHOD.POST,
      { ...input, position: { x: 96, y: 96 } },
    );
    const second = (await secondResponse.json()) as { widget: DashboardWidget };
    expect(secondResponse.status).toBe(HTTP_STATUS.OK);
    expect(second.widget.id).toBe(first.widget.id);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM dashboard_widgets WHERE type = 'storage-status'").first("count")).toBe(1);
  });

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

    const list = await SELF.fetch(`${ORIGIN}${API_PATHS.FILES}`);
    const page = (await list.json()) as { items: Array<{ id: string; name: string }> };
    expect(page.items).toEqual([
      expect.objectContaining({ id: created.file.id, name: "한글 문서.txt" }),
    ]);

    const download = await SELF.fetch(
      `${ORIGIN}${API_PATHS.FILES}/${created.file.id}/download`,
    );
    expect(download.status).toBe(HTTP_STATUS.OK);
    expect(download.headers.get(HTTP_HEADERS.CONTENT_DISPOSITION)).toContain(
      "filename*=UTF-8''",
    );
    await expect(download.text()).resolves.toBe(content);

    const deletion = await SELF.fetch(`${ORIGIN}${API_PATHS.FILES}/${created.file.id}`, {
      method: HTTP_METHOD.DELETE,
      headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
    });
    expect(deletion.status).toBe(HTTP_STATUS.NO_CONTENT);
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
    await SELF.fetch(`${ORIGIN}${API_PATHS.FILES}/${created.file.id}`, {
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

    const list = await SELF.fetch(`${ORIGIN}${API_PATHS.FILES}`);
    const page = (await list.json()) as { items: Array<{ id: string; name: string }> };
    expect(page.items).toHaveLength(2);
    expect(page.items.map((file) => file.name).sort()).toEqual([
      "same (2).txt",
      "same.txt",
    ]);
    expect(new Set(page.items.map((file) => file.id)).size).toBe(2);
  });

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

  it("streams supported media with single byte ranges", async () => {
    const body = "0123456789";
    const upload = await uploadFile(
      "clip.mp4",
      body,
      undefined,
      TEST_MEDIA_TYPE.VIDEO,
    );
    const created = (await upload.json()) as { file: { id: string } };
    const contentPath = `${ORIGIN}${API_PATHS.FILES}/${created.file.id}/${API_PATH_SEGMENTS.CONTENT}`;

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
      `${ORIGIN}${API_PATHS.FILES}/${created.file.id}/${API_PATH_SEGMENTS.CONTENT}`,
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
    const upload = await SELF.fetch(`${ORIGIN}${API_PATHS.FILES}?${query}`, {
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
    const thumbnailPath = `${ORIGIN}${API_PATHS.FILES}/${created.file.id}/${API_PATH_SEGMENTS.THUMBNAIL}`;
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

    await SELF.fetch(`${ORIGIN}${API_PATHS.FILES}/${created.file.id}`, {
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
      `${ORIGIN}${API_PATHS.FILES}/${entryId}/${API_PATH_SEGMENTS.THUMBNAIL}`,
    );

    expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect((await env.FILES.list()).objects).toHaveLength(1);
  });

  it("creates nested folders and moves entries without changing R2 keys", async () => {
    const directoriesPath = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.DIRECTORIES}`;
    const entriesPath = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.ENTRIES}`;
    const photosResponse = await jsonRequest(
      directoriesPath,
      HTTP_METHOD.POST,
      { name: "사진" },
    );
    const photos = (await photosResponse.json()) as { directory: { id: string } };
    const archiveResponse = await jsonRequest(
      directoriesPath,
      HTTP_METHOD.POST,
      { name: "보관함" },
    );
    const archive = (await archiveResponse.json()) as { directory: { id: string } };

    const upload = await uploadFile("여행.jpg", "image", photos.directory.id);
    const created = (await upload.json()) as { file: { id: string } };
    const objectKey = (await env.FILES.list()).objects[0]?.key;
    const move = await jsonRequest(
      `${entriesPath}/${created.file.id}`,
      HTTP_METHOD.PATCH,
      { parentId: archive.directory.id, name: "여행-완료.jpg" },
    );
    expect(move.status).toBe(HTTP_STATUS.OK);
    expect((await env.FILES.list()).objects[0]?.key).toBe(objectKey);

    const query = new URLSearchParams({
      [API_QUERY_PARAMETERS.PARENT_ID]: archive.directory.id,
    });
    const listing = await SELF.fetch(`${ORIGIN}${entriesPath}?${query}`);
    const page = (await listing.json()) as { items: Array<{ name: string }> };
    expect(page.items.map((item) => item.name)).toEqual(["여행-완료.jpg"]);
  });

  it("remembers independent sort settings for each active directory", async () => {
    const directoriesPath = FILESYSTEM_API_PATHS.DIRECTORIES;
    const entriesPath = FILESYSTEM_API_PATHS.ENTRIES;
    const createFolder = async (name: string) => {
      const response = await jsonRequest(directoriesPath, HTTP_METHOD.POST, {
        name,
      });
      return (await response.json()) as { directory: { id: string } };
    };
    const folderA = await createFolder("A 폴더");
    const folderB = await createFolder("B 폴더");
    const video = await uploadFile(
      "a-video.mp4",
      "12345678901234567890",
      undefined,
      TEST_MEDIA_TYPE.VIDEO,
    );
    const image = await uploadFile(
      "b-image.png",
      "1234567890",
      undefined,
      TEST_MEDIA_TYPE.IMAGE,
    );
    const videoBody = (await video.json()) as { file: { id: string } };
    const imageBody = (await image.json()) as { file: { id: string } };
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE filesystem_entries SET created_at = 100, updated_at = 300 WHERE id = ?1",
      ).bind(folderA.directory.id),
      env.DB.prepare(
        "UPDATE filesystem_entries SET created_at = 200, updated_at = 100 WHERE id = ?1",
      ).bind(folderB.directory.id),
      env.DB.prepare(
        "UPDATE filesystem_entries SET created_at = 300, updated_at = 200 WHERE id = ?1",
      ).bind(videoBody.file.id),
      env.DB.prepare(
        "UPDATE filesystem_entries SET created_at = 400, updated_at = 400 WHERE id = ?1",
      ).bind(imageBody.file.id),
    ]);

    const listDocuments = async () => {
      const query = new URLSearchParams({
        [API_QUERY_PARAMETERS.PARENT_ID]: FILESYSTEM_ROOT_ID.DOCUMENTS,
      });
      const response = await SELF.fetch(`${ORIGIN}${entriesPath}?${query}`);
      return (await response.json()) as {
        sort: { field: string; direction: string };
        items: Array<{ name: string }>;
      };
    };

    await expect(listDocuments()).resolves.toMatchObject({
      sort: DEFAULT_FILESYSTEM_DIRECTORY_SORT,
      items: [
        { name: "A 폴더" },
        { name: "B 폴더" },
        { name: "a-video.mp4" },
        { name: "b-image.png" },
      ],
    });

    const cases = [
      {
        field: FILESYSTEM_SORT_FIELD.NAME,
        direction: FILESYSTEM_SORT_DIRECTION.DESCENDING,
        names: ["B 폴더", "A 폴더", "b-image.png", "a-video.mp4"],
      },
      {
        field: FILESYSTEM_SORT_FIELD.CREATED_AT,
        direction: FILESYSTEM_SORT_DIRECTION.DESCENDING,
        names: ["B 폴더", "A 폴더", "b-image.png", "a-video.mp4"],
      },
      {
        field: FILESYSTEM_SORT_FIELD.UPDATED_AT,
        direction: FILESYSTEM_SORT_DIRECTION.ASCENDING,
        names: ["B 폴더", "A 폴더", "a-video.mp4", "b-image.png"],
      },
      {
        field: FILESYSTEM_SORT_FIELD.TYPE,
        direction: FILESYSTEM_SORT_DIRECTION.ASCENDING,
        names: ["A 폴더", "B 폴더", "b-image.png", "a-video.mp4"],
      },
      {
        field: FILESYSTEM_SORT_FIELD.SIZE,
        direction: FILESYSTEM_SORT_DIRECTION.DESCENDING,
        names: ["A 폴더", "B 폴더", "a-video.mp4", "b-image.png"],
      },
    ] as const;

    for (const sort of cases) {
      const response = await jsonRequest(
        `${directoriesPath}/${FILESYSTEM_ROOT_ID.DOCUMENTS}/${API_PATH_SEGMENTS.SORT}`,
        HTTP_METHOD.PUT,
        { field: sort.field, direction: sort.direction },
      );
      expect(response.status).toBe(HTTP_STATUS.OK);
      await expect(response.json()).resolves.toEqual({
        sort: { field: sort.field, direction: sort.direction },
      });
      expect((await listDocuments()).items.map((item) => item.name)).toEqual(
        sort.names,
      );
    }

    const childQuery = new URLSearchParams({
      [API_QUERY_PARAMETERS.PARENT_ID]: folderA.directory.id,
    });
    const childResponse = await SELF.fetch(`${ORIGIN}${entriesPath}?${childQuery}`);
    await expect(childResponse.json()).resolves.toMatchObject({
      sort: DEFAULT_FILESYSTEM_DIRECTORY_SORT,
    });
    await expect(
      env.DB.prepare(
        "SELECT COUNT(*) AS count FROM filesystem_directory_preferences",
      ).first("count"),
    ).resolves.toBe(1);

    const invalid = await jsonRequest(
      `${directoriesPath}/${FILESYSTEM_ROOT_ID.DOCUMENTS}/${API_PATH_SEGMENTS.SORT}`,
      HTTP_METHOD.PUT,
      { field: "unknown", direction: FILESYSTEM_SORT_DIRECTION.ASCENDING },
    );
    expect(invalid.status).toBe(HTTP_STATUS.BAD_REQUEST);
    await expect(invalid.json()).resolves.toEqual({
      error: {
        code: FILESYSTEM_ERRORS.INVALID_DIRECTORY_SORT.code,
        message: FILESYSTEM_ERRORS.INVALID_DIRECTORY_SORT.message,
      },
    });
  });

  it("rejects oversized and cross-origin uploads before persistence", async () => {
    const oversized = await SELF.fetch(`${ORIGIN}${API_PATHS.FILES}?name=large.bin`, {
      method: HTTP_METHOD.POST,
      headers: {
        [HTTP_HEADERS.CONTENT_TYPE]: DEFAULT_CONTENT_TYPE,
        [HTTP_HEADERS.FILE_SIZE]: String(MAX_FILE_SIZE_BYTES + 1),
        [HTTP_HEADERS.ORIGIN]: ORIGIN,
      },
      body: "x",
    });
    expect(oversized.status).toBe(HTTP_STATUS.CONTENT_TOO_LARGE);

    const crossOrigin = await SELF.fetch(`${ORIGIN}${API_PATHS.FILES}?name=file.txt`, {
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

  it("creates widgets and updates only their layouts", async () => {
    const initial = await SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`);
    await expect(initial.json()).resolves.toEqual({ items: [] });
    const first = await createWidget(WIDGET_TYPE.MEMO, { x: 32, y: 32 });
    const second = await createWidget(WIDGET_TYPE.MEMO, { x: 64, y: 64 });
    const items = [toLayout(first), toLayout(second)];
    const save = await saveWidgets(items);
    expect(save.status).toBe(HTTP_STATUS.OK);
    const widgets = items.map((item) => ({
      ...item,
      file: null,
      data: { markdown: "", updatedAt: null },
    }));
    await expect(save.json()).resolves.toEqual({ items: widgets });

    const stored = await SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`);
    await expect(stored.json()).resolves.toEqual({ items: widgets });

    const clear = await saveWidgets([]);
    expect(clear.status).toBe(HTTP_STATUS.OK);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM dashboard_widgets").first(
        "count",
      ),
    ).toBe(2);
    await discardWidget(first.id);
    await discardWidget(second.id);
  });

  it("stores widgets as D1-only files across close, reopen, trash, and purge", async () => {
    const created = await createWidget(WIDGET_TYPE.MEMO, { x: 32, y: 32 });
    expect(
      (
        await jsonRequest(
          `${widgetPath(created.id)}/${API_PATH_SEGMENTS.MEMO}`,
          HTTP_METHOD.PUT,
          { markdown: "휴지통까지 유지할 내용" },
        )
      ).status,
    ).toBe(HTTP_STATUS.OK);

    const save = await jsonRequest(
      `${widgetPath(created.id)}/${API_PATH_SEGMENTS.FILE}`,
      HTTP_METHOD.POST,
      { parentId: FILESYSTEM_ROOT_ID.DOCUMENTS, name: "보관할 메모" },
    );
    expect(save.status).toBe(HTTP_STATUS.CREATED);
    const saved = (await save.json()) as {
      entry: { id: string; widgetId: string; name: string };
      widget: DashboardWidget;
    };
    expect(saved.entry).toMatchObject({
      widgetId: created.id,
      name: "보관할 메모",
    });
    expect(saved.widget.file).toEqual({
      entryId: saved.entry.id,
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "보관할 메모",
    });
    expect((await env.FILES.list()).objects).toHaveLength(0);

    expect(
      (
        await jsonRequest(
          `${widgetPath(created.id)}/${API_PATH_SEGMENTS.CLOSE}`,
          HTTP_METHOD.POST,
          {},
        )
      ).status,
    ).toBe(HTTP_STATUS.NO_CONTENT);
    await expect(
      (await SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`)).json(),
    ).resolves.toEqual({ items: [] });

    const open = await jsonRequest(
      `${widgetPath(created.id)}/${API_PATH_SEGMENTS.OPEN}`,
      HTTP_METHOD.POST,
      {},
    );
    expect(open.status).toBe(HTTP_STATUS.OK);
    expect(((await open.json()) as { widget: DashboardWidget }).widget).toMatchObject({
      id: created.id,
      file: { entryId: saved.entry.id, name: "보관할 메모" },
      data: { markdown: "휴지통까지 유지할 내용" },
    });

    const entriesPath = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.ENTRIES}`;
    const trash = await SELF.fetch(`${ORIGIN}${entriesPath}/${saved.entry.id}`, {
      method: HTTP_METHOD.DELETE,
      headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
    });
    expect(trash.status).toBe(HTTP_STATUS.OK);
    await expect(trash.json()).resolves.toEqual({
      entry: null,
      closedWidgetIds: [created.id],
    });
    await expect(
      (await SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`)).json(),
    ).resolves.toEqual({ items: [] });

    const trashPath = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.TRASH}`;
    const restore = await jsonRequest(
      `${trashPath}/${saved.entry.id}/${API_PATH_SEGMENTS.RESTORE}`,
      HTTP_METHOD.POST,
      {
        parentId: FILESYSTEM_ROOT_ID.DESKTOP,
        desktopTargetIndex: 0,
        desktopCapacity: 1,
      },
    );
    expect(restore.status).toBe(HTTP_STATUS.OK);
    await expect(
      (await SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`)).json(),
    ).resolves.toEqual({ items: [] });

    expect(
      (
        await SELF.fetch(`${ORIGIN}${entriesPath}/${saved.entry.id}`, {
          method: HTTP_METHOD.DELETE,
          headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
        })
      ).status,
    ).toBe(HTTP_STATUS.OK);
    expect(
      (
        await SELF.fetch(`${ORIGIN}${trashPath}/${saved.entry.id}`, {
          method: HTTP_METHOD.DELETE,
          headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
        })
      ).status,
    ).toBe(HTTP_STATUS.NO_CONTENT);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM dashboard_widgets").first(
        "count",
      ),
    ).toBe(0);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM memo_widgets").first(
        "count",
      ),
    ).toBe(0);
  });

  it("persists desktop order swaps and rejects placement beyond capacity", async () => {
    const directoriesPath = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.DIRECTORIES}`;
    const firstResponse = await jsonRequest(directoriesPath, HTTP_METHOD.POST, {
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      name: "첫 번째",
      desktopTargetIndex: 0,
      desktopCapacity: 2,
    });
    const secondResponse = await jsonRequest(directoriesPath, HTTP_METHOD.POST, {
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      name: "두 번째",
      desktopTargetIndex: 1,
      desktopCapacity: 2,
    });
    const first = (await firstResponse.json()) as { directory: { id: string } };
    const second = (await secondResponse.json()) as { directory: { id: string } };

    const movePath = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.ENTRIES}/${first.directory.id}/${API_PATH_SEGMENTS.MOVE}`;
    const move = await jsonRequest(movePath, HTTP_METHOD.POST, {
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      desktopTargetIndex: 1,
      desktopCapacity: 2,
    });
    expect(move.status).toBe(HTTP_STATUS.OK);

    const query = new URLSearchParams({
      [API_QUERY_PARAMETERS.PARENT_ID]: FILESYSTEM_ROOT_ID.DESKTOP,
    });
    const page = (await (
      await SELF.fetch(`${ORIGIN}${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.ENTRIES}?${query}`)
    ).json()) as { items: Array<{ id: string }> };
    expect(page.items.map((entry) => entry.id)).toEqual([
      second.directory.id,
      first.directory.id,
    ]);

    const full = await jsonRequest(directoriesPath, HTTP_METHOD.POST, {
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      name: "세 번째",
      desktopTargetIndex: 2,
      desktopCapacity: 2,
    });
    expect(full.status).toBe(HTTP_STATUS.CONFLICT);
  });

  it("supports partial batch mutations and protected recursive download manifests", async () => {
    const firstResponse = await jsonRequest(
      FILESYSTEM_API_PATHS.DIRECTORIES,
      HTTP_METHOD.POST,
      {
        parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
        name: "첫 폴더",
      },
    );
    const secondResponse = await jsonRequest(
      FILESYSTEM_API_PATHS.DIRECTORIES,
      HTTP_METHOD.POST,
      {
        parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
        name: "둘째 폴더",
      },
    );
    const first = (await firstResponse.json()) as { directory: { id: string } };
    const second = (await secondResponse.json()) as { directory: { id: string } };

    const moved = await jsonRequest(
      FILESYSTEM_API_PATHS.BATCH_MOVE,
      HTTP_METHOD.POST,
      {
        entryIds: [first.directory.id, second.directory.id],
        parentId: FILESYSTEM_ROOT_ID.DESKTOP,
        desktopTargetIndex: 0,
        desktopCapacity: 2,
      },
    );
    expect(moved.status).toBe(HTTP_STATUS.OK);
    await expect(moved.json()).resolves.toMatchObject({
      succeededIds: [first.directory.id, second.directory.id],
      failures: [],
    });

    const trashed = await jsonRequest(
      FILESYSTEM_API_PATHS.BATCH_TRASH,
      HTTP_METHOD.POST,
      { entryIds: [first.directory.id, "missing-entry"] },
    );
    expect(trashed.status).toBe(HTTP_STATUS.OK);
    await expect(trashed.json()).resolves.toMatchObject({
      succeededIds: [first.directory.id],
      failures: [
        {
          id: "missing-entry",
          code: FILESYSTEM_ERRORS.ENTRY_NOT_FOUND.code,
        },
      ],
    });

    const restored = await jsonRequest(
      FILESYSTEM_API_PATHS.BATCH_RESTORE,
      HTTP_METHOD.POST,
      {
        entryIds: [first.directory.id],
        parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      },
    );
    expect(restored.status).toBe(HTTP_STATUS.OK);

    const upload = await uploadFile(
      "한글.txt",
      "archive-content",
      first.directory.id,
    );
    const file = (await upload.json()) as { file: { id: string } };
    const manifestResponse = await jsonRequest(
      FILESYSTEM_API_PATHS.DOWNLOAD_MANIFEST,
      HTTP_METHOD.POST,
      { entryIds: [first.directory.id, first.directory.id] },
    );
    expect(manifestResponse.status).toBe(HTTP_STATUS.OK);
    const manifest = (await manifestResponse.json()) as {
      archiveName: string;
      totalFileCount: number;
      entries: Array<Record<string, unknown>>;
    };
    expect(manifest.archiveName).toBe("첫 폴더.zip");
    expect(manifest.totalFileCount).toBe(1);
    const manifestFile = manifest.entries.find(
      (entry) => entry.id === file.file.id,
    );
    expect(manifestFile).toMatchObject({
      path: "첫 폴더/한글.txt",
      downloadUrl: `${API_PATHS.FILES}/${file.file.id}/download`,
    });
    expect(manifestFile).not.toHaveProperty("objectKey");
    const download = await SELF.fetch(
      `${ORIGIN}${String(manifestFile?.downloadUrl)}`,
    );
    expect(await download.text()).toBe("archive-content");
  });

  it("uses a shared 100-item limit only for directories and trash", async () => {
    const filesystemQuery = new URLSearchParams({
      [API_QUERY_PARAMETERS.PARENT_ID]: FILESYSTEM_ROOT_ID.DOCUMENTS,
      [API_QUERY_PARAMETERS.LIMIT]: "100",
    });
    expect(
      (await SELF.fetch(
        `${ORIGIN}${FILESYSTEM_API_PATHS.ENTRIES}?${filesystemQuery}`,
      )).status,
    ).toBe(HTTP_STATUS.OK);
    expect(
      (await SELF.fetch(
        `${ORIGIN}${FILESYSTEM_API_PATHS.TRASH}?${API_QUERY_PARAMETERS.LIMIT}=100`,
      )).status,
    ).toBe(HTTP_STATUS.OK);

    filesystemQuery.set(API_QUERY_PARAMETERS.LIMIT, "101");
    expect(
      (await SELF.fetch(
        `${ORIGIN}${FILESYSTEM_API_PATHS.ENTRIES}?${filesystemQuery}`,
      )).status,
    ).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(
      (await SELF.fetch(
        `${ORIGIN}${FILESYSTEM_API_PATHS.TRASH}?${API_QUERY_PARAMETERS.LIMIT}=101`,
      )).status,
    ).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(
      (await SELF.fetch(
        `${ORIGIN}${API_PATHS.FILES}?${API_QUERY_PARAMETERS.LIMIT}=50`,
      )).status,
    ).toBe(HTTP_STATUS.OK);
    expect(
      (await SELF.fetch(
        `${ORIGIN}${API_PATHS.FILES}?${API_QUERY_PARAMETERS.LIMIT}=51`,
      )).status,
    ).toBe(HTTP_STATUS.BAD_REQUEST);
  });

  it("rejects invalid or cross-origin widget replacements without data loss", async () => {
    const created = await createWidget(WIDGET_TYPE.MEMO, { x: 32, y: 32 });
    const original = [toLayout(created)];
    expect((await saveWidgets(original)).status).toBe(HTTP_STATUS.OK);

    const duplicateStackOrder = await saveWidgets([
      ...original,
      {
        id: "00000000-0000-4000-8000-000000000002",
        type: WIDGET_TYPE.MEMO,
        position: { x: 48, y: 48 },
        size: {
          width: MEMO_WINDOW_POLICY.DEFAULT_WIDTH,
          height: MEMO_WINDOW_POLICY.DEFAULT_HEIGHT,
        },
        windowState: WINDOW_STATE.NORMAL,
        restoreState: WINDOW_RESTORE_STATE.NORMAL,
        stackOrder: 0,
      },
    ]);
    expect(duplicateStackOrder.status).toBe(HTTP_STATUS.BAD_REQUEST);

    const typeChange = await saveWidgets([
      { ...original[0]!, type: WIDGET_TYPE.DAILY_CHECKLIST },
    ]);
    expect(typeChange.status).toBe(HTTP_STATUS.CONFLICT);

    const crossOrigin = await SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`, {
      method: HTTP_METHOD.PUT,
      headers: {
        [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON,
        [HTTP_HEADERS.ORIGIN]: "https://attacker.example",
      },
      body: JSON.stringify({ items: [] }),
    });
    expect(crossOrigin.status).toBe(HTTP_STATUS.FORBIDDEN);

    const stored = await SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`);
    await expect(stored.json()).resolves.toEqual({
      items: original.map((item) => ({
        ...item,
        file: null,
        data: { markdown: "", updatedAt: null },
      })),
    });
  });

  it("stores memo content independently from layout changes", async () => {
    const created = await createWidget(WIDGET_TYPE.MEMO, { x: 32, y: 32 });
    const id = created.id;
    const layout = toLayout(created);
    expect((await saveWidgets([layout])).status).toBe(HTTP_STATUS.OK);

    const memoSave = await jsonRequest(
      `${widgetPath(id)}/${API_PATH_SEGMENTS.MEMO}`,
      HTTP_METHOD.PUT,
      { markdown: "# 오늘의 메모\n\n**중요**" },
    );
    expect(memoSave.status).toBe(HTTP_STATUS.OK);

    expect(
      (
        await saveWidgets([
          { ...layout, position: { x: 303, y: 240 } },
        ])
      ).status,
    ).toBe(HTTP_STATUS.OK);

    const stored = await SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`);
    await expect(stored.json()).resolves.toEqual({
      items: [
        {
          ...layout,
          position: { x: 303, y: 240 },
          file: null,
          data: {
            markdown: "# 오늘의 메모\n\n**중요**",
            updatedAt: expect.any(String),
          },
        },
      ],
    });

    expect((await discardWidget(id)).status).toBe(HTTP_STATUS.NO_CONTENT);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM memo_widgets").first(
        "count",
      ),
    ).toBe(0);
  });

  it("manages daily checklist items and records each actual state change", async () => {
    const createdWidget = await createWidget(
      WIDGET_TYPE.DAILY_CHECKLIST,
      { x: 32, y: 32 },
    );
    const widgetId = createdWidget.id;
    const layout = toLayout(createdWidget);
    expect((await saveWidgets([layout])).status).toBe(HTTP_STATUS.OK);

    const creation = await jsonRequest(
      `${checklistPath(widgetId)}/${API_PATH_SEGMENTS.ITEMS}`,
      HTTP_METHOD.POST,
      { label: "물 마시기" },
    );
    expect(creation.status).toBe(HTTP_STATUS.CREATED);
    const created = (await creation.json()) as { item: { id: string } };
    const itemPath = `${checklistPath(widgetId)}/${API_PATH_SEGMENTS.ITEMS}/${created.item.id}`;

    expect(
      (await jsonRequest(`${itemPath}/${API_PATH_SEGMENTS.CHECK}`, HTTP_METHOD.PUT, {
        checked: true,
      })).status,
    ).toBe(HTTP_STATUS.OK);
    expect(
      (await jsonRequest(`${itemPath}/${API_PATH_SEGMENTS.CHECK}`, HTTP_METHOD.PUT, {
        checked: true,
      })).status,
    ).toBe(HTTP_STATUS.OK);
    expect(
      (await jsonRequest(itemPath, HTTP_METHOD.PUT, { label: "물 두 잔 마시기" }))
        .status,
    ).toBe(HTTP_STATUS.OK);
    expect(
      (await jsonRequest(`${itemPath}/${API_PATH_SEGMENTS.CHECK}`, HTTP_METHOD.PUT, {
        checked: false,
      })).status,
    ).toBe(HTTP_STATUS.OK);

    const checklist = await SELF.fetch(`${ORIGIN}${checklistPath(widgetId)}`);
    await expect(checklist.json()).resolves.toEqual({
      businessDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      nextResetAt: expect.any(String),
      items: [
        {
          id: created.item.id,
          label: "물 두 잔 마시기",
          checked: false,
        },
      ],
    });

    const logs = await SELF.fetch(
      `${ORIGIN}${checklistPath(widgetId)}/${API_PATH_SEGMENTS.LOGS}`,
    );
    const logPage = (await logs.json()) as {
      items: Array<{
        action: string;
        itemLabel: string;
        previousItemLabel: string | null;
      }>;
      nextOffset: number | null;
    };
    expect(logPage.nextOffset).toBeNull();
    expect(logPage.items).toHaveLength(4);
    expect(logPage.items.map(({ action, itemLabel }) => ({ action, itemLabel })))
      .toEqual(expect.arrayContaining([
        {
          action: CHECKLIST_EVENT_ACTION.ADDED,
          itemLabel: "물 마시기",
        },
        {
          action: CHECKLIST_EVENT_ACTION.RENAMED,
          itemLabel: "물 두 잔 마시기",
        },
        {
          action: CHECKLIST_EVENT_ACTION.UNCHECKED,
          itemLabel: "물 두 잔 마시기",
        },
        {
          action: CHECKLIST_EVENT_ACTION.CHECKED,
          itemLabel: "물 마시기",
        },
      ]));
    expect(
      logPage.items.find(
        ({ action }) => action === CHECKLIST_EVENT_ACTION.RENAMED,
      ),
    ).toMatchObject({
      previousItemLabel: "물 마시기",
    });

    const deletion = await SELF.fetch(`${ORIGIN}${itemPath}`, {
      method: HTTP_METHOD.DELETE,
      headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
    });
    expect(deletion.status).toBe(HTTP_STATUS.NO_CONTENT);
    const afterDeletion = await SELF.fetch(`${ORIGIN}${checklistPath(widgetId)}`);
    expect(((await afterDeletion.json()) as { items: unknown[] }).items).toEqual([]);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM checklist_events").first(
        "count",
      ),
    ).toBe(5);
    const logsAfterDeletion = await SELF.fetch(
      `${ORIGIN}${checklistPath(widgetId)}/${API_PATH_SEGMENTS.LOGS}`,
    );
    const deletionLogPage = (await logsAfterDeletion.json()) as {
      items: Array<{ action: string; itemLabel: string }>;
    };
    expect(deletionLogPage.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: CHECKLIST_EVENT_ACTION.DELETED,
          itemLabel: "물 두 잔 마시기",
        }),
      ]),
    );

    expect((await discardWidget(widgetId)).status).toBe(HTTP_STATUS.NO_CONTENT);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM checklist_events").first(
        "count",
      ),
    ).toBe(0);
  });
});

function uploadFile(
  name: string,
  content: string,
  parentId?: string,
  contentType: string = TEST_MEDIA_TYPE.TEXT,
): Promise<Response> {
  const bytes = new TextEncoder().encode(content);
  const query = new URLSearchParams({ [API_QUERY_PARAMETERS.FILE_NAME]: name });
  if (parentId) {
    query.set(API_QUERY_PARAMETERS.PARENT_ID, parentId);
  }
  return SELF.fetch(`${ORIGIN}${API_PATHS.FILES}?${query}`, {
    method: HTTP_METHOD.POST,
    headers: {
      [HTTP_HEADERS.CONTENT_TYPE]: contentType,
      [HTTP_HEADERS.FILE_SIZE]: String(bytes.byteLength),
      [HTTP_HEADERS.ORIGIN]: ORIGIN,
    },
    body: bytes,
  });
}

function uploadNovelAiImage(
  content: string,
  contentType: string = TEST_MEDIA_TYPE.IMAGE,
  query?: URLSearchParams,
): Promise<Response> {
  const bytes = new TextEncoder().encode(content);
  const queryString = query ? `?${query.toString()}` : "";
  return SELF.fetch(`${ORIGIN}${NOVELAI_IMAGE_UPLOAD_API_PATH}${queryString}`, {
    method: HTTP_METHOD.POST,
    headers: {
      [HTTP_HEADERS.CONTENT_TYPE]: contentType,
      [HTTP_HEADERS.FILE_SIZE]: String(bytes.byteLength),
    },
    body: bytes,
  });
}

async function decodeResponseBody(response: Response): Promise<string> {
  return new TextDecoder().decode(await response.arrayBuffer());
}

function saveWidgets(items: unknown[]): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`, {
    method: HTTP_METHOD.PUT,
    headers: {
      [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON,
      [HTTP_HEADERS.ORIGIN]: ORIGIN,
    },
    body: JSON.stringify({ items }),
  });
}

async function createWidget(
  type: WidgetType,
  position: { readonly x: number; readonly y: number },
): Promise<DashboardWidget> {
  const policy = WIDGET_WINDOW_POLICY[type];
  const response = await jsonRequest(API_PATHS.WIDGETS, HTTP_METHOD.POST, {
    type,
    position,
    size: {
      width: policy.DEFAULT_WIDTH,
      height: policy.DEFAULT_HEIGHT,
    },
  });
  expect(response.status).toBe(HTTP_STATUS.CREATED);
  return ((await response.json()) as { widget: DashboardWidget }).widget;
}

function discardWidget(widgetId: string): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${widgetPath(widgetId)}`, {
    method: HTTP_METHOD.DELETE,
    headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
  });
}

function toLayout(widget: DashboardWidget): WidgetLayout {
  return {
    id: widget.id,
    type: widget.type,
    position: widget.position,
    size: widget.size,
    windowState: widget.windowState,
    restoreState: widget.restoreState,
    stackOrder: widget.stackOrder,
  };
}

function widgetPath(widgetId: string): string {
  return `${API_PATHS.WIDGETS}/${widgetId}`;
}

function checklistPath(widgetId: string): string {
  return `${widgetPath(widgetId)}/${API_PATH_SEGMENTS.CHECKLIST}`;
}

function jsonRequest(
  url: string,
  method: string,
  body: unknown,
): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${url}`, {
    method,
    headers: {
      [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON,
      [HTTP_HEADERS.ORIGIN]: ORIGIN,
    },
    body: JSON.stringify(body),
  });
}
