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

describe("computer-room filesystem entry API", () => {
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

  it("reports recursive details only for active folders", async () => {
    const photosResponse = await jsonRequest(
      FILESYSTEM_API_PATHS.DIRECTORIES,
      HTTP_METHOD.POST,
      { parentId: FILESYSTEM_ROOT_ID.DOCUMENTS, name: "사진" },
    );
    const photos = (await photosResponse.json()) as {
      directory: { id: string };
    };
    const tripResponse = await jsonRequest(
      FILESYSTEM_API_PATHS.DIRECTORIES,
      HTTP_METHOD.POST,
      { parentId: photos.directory.id, name: "여행" },
    );
    const trip = (await tripResponse.json()) as {
      directory: { id: string };
    };
    const rootFileResponse = await uploadFile(
      "목록.txt",
      "root",
      photos.directory.id,
    );
    const rootFile = (await rootFileResponse.json()) as {
      file: { id: string };
    };
    await uploadFile("일정.txt", "nested", trip.directory.id);
    const widget = await createWidget(WIDGET_TYPE.MEMO, { x: 32, y: 32 });
    expect(
      (
        await jsonRequest(
          `${widgetPath(widget.id)}/${API_PATH_SEGMENTS.FILE}`,
          HTTP_METHOD.POST,
          { parentId: trip.directory.id, name: "여행 메모" },
        )
      ).status,
    ).toBe(HTTP_STATUS.CREATED);

    const detailsPath = `${FILESYSTEM_API_PATHS.DIRECTORIES}/${photos.directory.id}/${API_PATH_SEGMENTS.DETAILS}`;
    const response = await SELF.fetch(`${ORIGIN}${detailsPath}`);
    const body = (await response.json()) as {
      details: FilesystemDirectoryDetails;
    };

    expect(response.status).toBe(HTTP_STATUS.OK);
    expect(body.details).toMatchObject({
      directory: { id: photos.directory.id, name: "사진" },
      breadcrumbs: [
        { id: FILESYSTEM_ROOT_ID.DOCUMENTS, name: "내 문서" },
        { id: photos.directory.id, name: "사진" },
      ],
      totalBytes: 10,
      fileCount: 2,
      directoryCount: 1,
      widgetCount: 1,
    });

    const fileResponse = await SELF.fetch(
      `${ORIGIN}${FILESYSTEM_API_PATHS.DIRECTORIES}/${rootFile.file.id}/${API_PATH_SEGMENTS.DETAILS}`,
    );
    expect(fileResponse.status).toBe(HTTP_STATUS.NOT_FOUND);

    const wrongMethod = await jsonRequest(detailsPath, HTTP_METHOD.POST, {});
    expect(wrongMethod.status).toBe(HTTP_STATUS.METHOD_NOT_ALLOWED);

    expect(
      (
        await SELF.fetch(
          `${ORIGIN}${FILESYSTEM_API_PATHS.ENTRIES}/${photos.directory.id}`,
          {
            method: HTTP_METHOD.DELETE,
            headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
          },
        )
      ).status,
    ).toBe(HTTP_STATUS.OK);
    const trashedResponse = await SELF.fetch(`${ORIGIN}${detailsPath}`);
    expect(trashedResponse.status).toBe(HTTP_STATUS.NOT_FOUND);
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
});
