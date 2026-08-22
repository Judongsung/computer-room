import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  API_PATHS,
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
} from "../src/constants/api";
import { ACCESS_LOGOUT_PATH } from "../src/constants/auth";
import { CHECKLIST_EVENT_ACTION } from "../src/constants/checklist";
import {
  DEFAULT_CONTENT_TYPE,
  FILE_OBJECT_KEY_PREFIX,
  MAX_FILE_SIZE_BYTES,
} from "../src/constants/file";
import { FILESYSTEM_ROOT_ID } from "../src/constants/filesystem";
import {
  HTTP_HEADERS,
  HTTP_MEDIA_TYPE,
  HTTP_METHOD,
  HTTP_STATUS,
} from "../src/constants/http";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "../src/constants/widget";
import type { DashboardWidget, WidgetLayout, WidgetType } from "../src/types/widget";

const ORIGIN = "http://localhost";
const TEST_MEDIA_TYPE = {
  TEXT: "text/plain",
  VIDEO: "video/mp4",
} as const;
const MEMO_WINDOW_POLICY = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];

beforeEach(async () => {
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
