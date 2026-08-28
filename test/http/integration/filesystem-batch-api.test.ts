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

describe("computer-room filesystem batch API", () => {
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
      downloadUrl: `${FILESYSTEM_API_PATHS.FILES}/${file.file.id}/${API_PATH_SEGMENTS.DOWNLOAD}`,
    });
    expect(manifestFile).not.toHaveProperty("objectKey");
    const download = await SELF.fetch(
      `${ORIGIN}${String(manifestFile?.downloadUrl)}`,
    );
    expect(await download.text()).toBe("archive-content");
  });

  it("uses a shared 100-item limit for directories and trash", async () => {
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
  });
});
