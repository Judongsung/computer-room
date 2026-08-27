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

describe("computer-room widget API", () => {
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
