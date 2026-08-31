import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { GUEST_PUBLICATION_STATE } from "@/constants/admin/guest-access";
import { GUEST_ACCESS_ERRORS } from "@/constants/admin/errors/guest-access";
import {
  API_PATHS,
  API_PATH_SEGMENTS,
  FILESYSTEM_API_PATHS,
  GUEST_ACCESS_API_PATH,
  GUEST_ACCESS_API_PATHS,
} from "@/constants/platform/api";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import {
  HTTP_HEADERS,
  HTTP_MEDIA_TYPE,
  HTTP_METHOD,
  HTTP_STATUS,
} from "@/constants/platform/http";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type {
  GuestAccessDirectoryPage,
  GuestPublicationMutationResult,
} from "@/types/admin/guest-access";
import type { WidgetFileDocument } from "@/types/widgets/widget-file";
import {
  ORIGIN,
  jsonRequest,
  resetWorkerState,
  uploadFile,
} from "@test/support/http/worker-api-harness";

beforeEach(resetWorkerState);

describe("guest access administration API", () => {
  it("keeps publication choices when the disabled-by-default master switch changes", async () => {
    const initial = await SELF.fetch(`${ORIGIN}${GUEST_ACCESS_API_PATH}`);
    expect(initial.status).toBe(HTTP_STATUS.OK);
    expect(initial.headers.get(HTTP_HEADERS.CACHE_CONTROL)).toBe(
      "private, no-store",
    );
    await expect(initial.json()).resolves.toEqual({
      settings: { enabled: false },
    });

    const file = await uploadedFile("shared.png");
    expect((await setPublished(file.id, true)).status).toBe(HTTP_STATUS.OK);

    const missingOrigin = await SELF.fetch(
      `${ORIGIN}${GUEST_ACCESS_API_PATH}`,
      {
        method: HTTP_METHOD.PATCH,
        headers: { [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON },
        body: JSON.stringify({ enabled: true }),
      },
    );
    expect(missingOrigin.status).toBe(HTTP_STATUS.FORBIDDEN);

    const enabled = await jsonRequest(
      GUEST_ACCESS_API_PATH,
      HTTP_METHOD.PATCH,
      { enabled: true },
    );
    expect(enabled.status).toBe(HTTP_STATUS.OK);
    await expect(enabled.json()).resolves.toEqual({
      settings: { enabled: true },
    });
    await jsonRequest(GUEST_ACCESS_API_PATH, HTTP_METHOD.PATCH, {
      enabled: false,
    });
    await expect(publicationIds()).resolves.toEqual([file.id]);
  });

  it("publishes current subtrees, keeps identity across moves, and clears on trash", async () => {
    const folder = await createDirectory(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "공개 폴더",
    );
    const nested = await createDirectory(folder.id, "하위 폴더");
    const file = await uploadedFile("기존.png", nested.id);
    const programDocument = await createProgramDocument(folder.id);

    const published = await setPublished(folder.id, true);
    expect(published.status).toBe(HTTP_STATUS.OK);
    await expect(published.json()).resolves.toEqual({
      entryId: folder.id,
      publicationState: GUEST_PUBLICATION_STATE.PUBLIC,
      affectedCount: 4,
    } satisfies GuestPublicationMutationResult);
    expect(stateOf(await directoryPage(FILESYSTEM_ROOT_ID.DOCUMENTS), folder.id))
      .toBe(GUEST_PUBLICATION_STATE.PUBLIC);
    expect(stateOf(await directoryPage(folder.id), programDocument.entry.id))
      .toBe(GUEST_PUBLICATION_STATE.PUBLIC);

    const laterFile = await uploadedFile("나중.png", folder.id);
    expect(stateOf(await directoryPage(FILESYSTEM_ROOT_ID.DOCUMENTS), folder.id))
      .toBe(GUEST_PUBLICATION_STATE.PARTIAL);
    expect(stateOf(await directoryPage(folder.id), laterFile.id)).toBe(
      GUEST_PUBLICATION_STATE.PRIVATE,
    );

    const renamed = await jsonRequest(
      `${FILESYSTEM_API_PATHS.ENTRIES}/${file.id}`,
      HTTP_METHOD.PATCH,
      { name: "이름 변경.png" },
    );
    expect(renamed.status).toBe(HTTP_STATUS.OK);
    const moved = await jsonRequest(
      `${FILESYSTEM_API_PATHS.ENTRIES}/${file.id}/${API_PATH_SEGMENTS.MOVE}`,
      HTTP_METHOD.POST,
      { parentId: FILESYSTEM_ROOT_ID.DESKTOP, desktopTargetIndex: 0, desktopCapacity: 10 },
    );
    expect(moved.status).toBe(HTTP_STATUS.OK);
    await expect(publicationIds()).resolves.toContain(file.id);

    const trashedFolder = await SELF.fetch(
      `${ORIGIN}${FILESYSTEM_API_PATHS.ENTRIES}/${folder.id}`,
      {
        method: HTTP_METHOD.DELETE,
        headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
      },
    );
    expect(trashedFolder.status).toBe(HTTP_STATUS.OK);
    await expect(publicationIds()).resolves.toEqual([file.id]);

    const restored = await jsonRequest(
      `${FILESYSTEM_API_PATHS.TRASH}/${folder.id}/${API_PATH_SEGMENTS.RESTORE}`,
      HTTP_METHOD.POST,
      { parentId: FILESYSTEM_ROOT_ID.DOCUMENTS },
    );
    expect(restored.status).toBe(HTTP_STATUS.OK);
    expect(stateOf(await directoryPage(FILESYSTEM_ROOT_ID.DOCUMENTS), folder.id))
      .toBe(GUEST_PUBLICATION_STATE.PRIVATE);

    expect(
      (
        await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.ENTRIES}/${file.id}`, {
          method: HTTP_METHOD.DELETE,
          headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
        })
      ).status,
    ).toBe(HTTP_STATUS.OK);
    await expect(publicationIds()).resolves.toEqual([]);
  });

  it("rejects system roots and inactive entries", async () => {
    const rootResponse = await setPublished(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      true,
    );
    expect(rootResponse.status).toBe(
      GUEST_ACCESS_ERRORS.SYSTEM_ROOT_NOT_PUBLISHABLE.status,
    );

    const file = await uploadedFile("private.png");
    expect(
      (
        await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.ENTRIES}/${file.id}`, {
          method: HTTP_METHOD.DELETE,
          headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
        })
      ).status,
    ).toBe(HTTP_STATUS.OK);
    const inactive = await setPublished(file.id, true);
    expect(inactive.status).toBe(GUEST_ACCESS_ERRORS.ENTRY_NOT_ACTIVE.status);
    await expect(inactive.json()).resolves.toEqual({
      error: {
        code: GUEST_ACCESS_ERRORS.ENTRY_NOT_ACTIVE.code,
        message: GUEST_ACCESS_ERRORS.ENTRY_NOT_ACTIVE.message,
      },
    });
  });

  it("pages directory publication states in shared 100-item pages", async () => {
    await env.DB.batch(
      Array.from({ length: 101 }, (_, index) => {
        const id = `page-entry-${String(index).padStart(3, "0")}`;
        return env.DB
          .prepare(
            `INSERT INTO filesystem_entries(
              id, parent_id, kind, name, name_key, file_id, widget_id,
              restore_parent_id, restore_path, trashed_at, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?1, ?1, NULL, NULL, NULL, NULL, NULL, ?4, ?4)`,
          )
          .bind(
            id,
            FILESYSTEM_ROOT_ID.DOCUMENTS,
            FILESYSTEM_ENTRY_KIND.DIRECTORY,
            index,
          );
      }),
    );

    const first = await directoryPage(FILESYSTEM_ROOT_ID.DOCUMENTS);
    expect(first.items).toHaveLength(100);
    expect(first.nextOffset).toBe(100);
    expect(
      first.items.every(
        (item) =>
          item.publicationState === GUEST_PUBLICATION_STATE.PRIVATE,
      ),
    ).toBe(true);

    const response = await SELF.fetch(
      `${ORIGIN}${GUEST_ACCESS_API_PATHS.DIRECTORIES}/${FILESYSTEM_ROOT_ID.DOCUMENTS}?offset=100`,
    );
    const second = (await response.json()) as GuestAccessDirectoryPage;
    expect(second.items).toHaveLength(1);
    expect(second.nextOffset).toBeNull();
  });
});

async function createDirectory(parentId: string, name: string) {
  const response = await jsonRequest(
    FILESYSTEM_API_PATHS.DIRECTORIES,
    HTTP_METHOD.POST,
    { parentId, name },
  );
  expect(response.status).toBe(HTTP_STATUS.CREATED);
  return ((await response.json()) as { directory: { id: string } }).directory;
}

async function uploadedFile(name: string, parentId?: string) {
  const response = await uploadFile(name, "image", parentId, "image/png");
  expect(response.status).toBe(HTTP_STATUS.CREATED);
  return ((await response.json()) as { file: { id: string } }).file;
}

async function createProgramDocument(parentId: string): Promise<WidgetFileDocument> {
  const response = await jsonRequest(
    API_PATHS.WIDGET_FILES,
    HTTP_METHOD.POST,
    {
      type: WIDGET_TYPE.MEMO,
      parentId,
      name: "공개 메모",
      data: { markdown: "# 공개" },
    },
  );
  expect(response.status).toBe(HTTP_STATUS.CREATED);
  return (await response.json()) as WidgetFileDocument;
}

function setPublished(entryId: string, published: boolean): Promise<Response> {
  return jsonRequest(
    `${GUEST_ACCESS_API_PATHS.ENTRIES}/${entryId}`,
    HTTP_METHOD.PUT,
    { published },
  );
}

async function directoryPage(directoryId: string): Promise<GuestAccessDirectoryPage> {
  const response = await SELF.fetch(
    `${ORIGIN}${GUEST_ACCESS_API_PATHS.DIRECTORIES}/${directoryId}`,
  );
  expect(response.status).toBe(HTTP_STATUS.OK);
  return (await response.json()) as GuestAccessDirectoryPage;
}

function stateOf(page: GuestAccessDirectoryPage, entryId: string) {
  return page.items.find((item) => item.entry.id === entryId)?.publicationState;
}

async function publicationIds(): Promise<string[]> {
  const result = await env.DB
    .prepare("SELECT entry_id FROM guest_publications ORDER BY entry_id")
    .all<{ entry_id: string }>();
  return result.results.map((row) => row.entry_id);
}
