import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { API_PATHS } from "@/constants/platform/api";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { HTTP_HEADERS, HTTP_MEDIA_TYPE, HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { WIDGET_TYPE, WIDGET_WINDOW_POLICY } from "@/constants/widgets/widget";
import type { WidgetFileDocument } from "@/types/widgets/widget-file";

const ORIGIN = "http://localhost";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM desktop_entry_order").run();
  await env.DB
    .prepare("DELETE FROM filesystem_entries WHERE id NOT IN (?1, ?2, ?3)")
    .bind(
      FILESYSTEM_ROOT_ID.DESKTOP,
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      FILESYSTEM_ROOT_ID.RECYCLE_BIN,
    )
    .run();
  await env.DB.prepare("DELETE FROM dashboard_widgets").run();
});

describe("widget file API", () => {
  it("creates and reads a closed memo without changing the PC open widgets", async () => {
    const response = await requestWidgetFile({
      type: WIDGET_TYPE.MEMO,
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      name: "모바일 메모",
      data: { markdown: "# 휴대폰에서 작성" },
    });
    const document = (await response.json()) as WidgetFileDocument;

    expect(response.status).toBe(HTTP_STATUS.CREATED);
    expect(document.entry).toMatchObject({
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      name: "모바일 메모",
      widgetType: WIDGET_TYPE.MEMO,
      desktopOrder: 0,
    });
    expect(document.widget).toMatchObject({
      type: WIDGET_TYPE.MEMO,
      data: { markdown: "# 휴대폰에서 작성" },
      position: { x: 32, y: 32 },
      size: {
        width: WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO].DEFAULT_WIDTH,
        height: WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO].DEFAULT_HEIGHT,
      },
    });
    const stored = await env.DB
      .prepare("SELECT is_open FROM dashboard_widgets WHERE id = ?1")
      .bind(document.widget.id)
      .first<{ is_open: number }>();
    expect(stored?.is_open).toBe(0);

    const getResponse = await SELF.fetch(
      `${ORIGIN}${API_PATHS.WIDGET_FILES}/${document.entry.id}`,
    );
    expect(getResponse.status).toBe(HTTP_STATUS.OK);
    await expect(getResponse.json()).resolves.toMatchObject({
      widget: { id: document.widget.id, data: { markdown: "# 휴대폰에서 작성" } },
      entry: { id: document.entry.id },
    });
    const desktopWidgets = await SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`);
    await expect(desktopWidgets.json()).resolves.toEqual({ items: [] });
  });

  it("stores a checklist snapshot without creating draft history", async () => {
    const response = await requestWidgetFile({
      type: WIDGET_TYPE.DAILY_CHECKLIST,
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "아침 목록",
      data: {
        items: [
          { label: "물 마시기", checked: true },
          { label: "산책", checked: false },
        ],
      },
    });
    const document = (await response.json()) as WidgetFileDocument;

    expect(response.status).toBe(HTTP_STATUS.CREATED);
    expect(document.widget).toMatchObject({
      type: WIDGET_TYPE.DAILY_CHECKLIST,
      data: {
        items: [
          { label: "물 마시기", checked: true },
          { label: "산책", checked: false },
        ],
      },
    });
    const eventCount = await env.DB
      .prepare("SELECT COUNT(*) AS count FROM checklist_events WHERE widget_id = ?1")
      .bind(document.widget.id)
      .first<{ count: number }>();
    const stateCount = await env.DB
      .prepare("SELECT COUNT(*) AS count FROM checklist_period_states")
      .first<{ count: number }>();
    expect(eventCount?.count).toBe(0);
    expect(stateCount?.count).toBe(1);
  });

  it("auto-numbers an occupied widget file name", async () => {
    const input = {
      type: WIDGET_TYPE.MEMO,
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "메모",
      data: { markdown: "" },
    } as const;
    expect((await (await requestWidgetFile(input)).json()) as WidgetFileDocument)
      .toMatchObject({ entry: { name: "메모" } });
    expect((await (await requestWidgetFile(input)).json()) as WidgetFileDocument)
      .toMatchObject({ entry: { name: "메모 (2)" } });
  });

  it("rejects invalid snapshots without leaving partial widget data", async () => {
    const response = await requestWidgetFile({
      type: WIDGET_TYPE.DAILY_CHECKLIST,
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "잘못된 목록",
      data: { items: [{ label: "   ", checked: false }] },
    });
    expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
    const count = await env.DB
      .prepare("SELECT COUNT(*) AS count FROM dashboard_widgets")
      .first<{ count: number }>();
    expect(count?.count).toBe(0);
  });
});

function requestWidgetFile(body: unknown): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${API_PATHS.WIDGET_FILES}`, {
    method: HTTP_METHOD.POST,
    headers: {
      [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON,
      [HTTP_HEADERS.ORIGIN]: ORIGIN,
    },
    body: JSON.stringify(body),
  });
}
