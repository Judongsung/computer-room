import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { API_PATHS, API_QUERY_PARAMETERS } from "../src/constants/api";
import { ACCESS_LOGOUT_PATH } from "../src/constants/auth";
import {
  DEFAULT_CONTENT_TYPE,
  FILE_OBJECT_KEY_PREFIX,
  MAX_FILE_SIZE_BYTES,
} from "../src/constants/file";
import {
  HTTP_HEADERS,
  HTTP_MEDIA_TYPE,
  HTTP_METHOD,
  HTTP_STATUS,
} from "../src/constants/http";
import { BLANK_WIDGET_SIZE, WIDGET_TYPE } from "../src/constants/widget";

const ORIGIN = "http://localhost";
const TEST_MEDIA_TYPE = {
  TEXT: "text/plain",
} as const;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM files").run();
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

  it("uploads, lists, downloads, and permanently deletes a file", async () => {
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
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM files").first("count")).toBe(0);
    expect((await env.FILES.list()).objects).toHaveLength(0);
  });

  it("allows duplicate original names with different object keys", async () => {
    expect((await uploadFile("same.txt", "first")).status).toBe(
      HTTP_STATUS.CREATED,
    );
    expect((await uploadFile("same.txt", "second")).status).toBe(
      HTTP_STATUS.CREATED,
    );

    const list = await SELF.fetch(`${ORIGIN}${API_PATHS.FILES}`);
    const page = (await list.json()) as { items: Array<{ id: string; name: string }> };
    expect(page.items).toHaveLength(2);
    expect(page.items.every((file) => file.name === "same.txt")).toBe(true);
    expect(new Set(page.items.map((file) => file.id)).size).toBe(2);
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

  it("persists and replaces the complete widget layout", async () => {
    const items = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        type: WIDGET_TYPE.BLANK,
        position: { column: 0, row: 0 },
        size: {
          columns: BLANK_WIDGET_SIZE.DEFAULT_COLUMNS,
          rows: BLANK_WIDGET_SIZE.DEFAULT_ROWS,
        },
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        type: WIDGET_TYPE.BLANK,
        position: { column: BLANK_WIDGET_SIZE.DEFAULT_COLUMNS, row: 0 },
        size: {
          columns: BLANK_WIDGET_SIZE.DEFAULT_COLUMNS,
          rows: BLANK_WIDGET_SIZE.DEFAULT_ROWS,
        },
      },
    ];

    const initial = await SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`);
    await expect(initial.json()).resolves.toEqual({ items: [] });

    const save = await saveWidgets(items);
    expect(save.status).toBe(HTTP_STATUS.OK);
    await expect(save.json()).resolves.toEqual({ items });

    const stored = await SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`);
    await expect(stored.json()).resolves.toEqual({ items });

    const clear = await saveWidgets([]);
    expect(clear.status).toBe(HTTP_STATUS.OK);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM dashboard_widgets").first(
        "count",
      ),
    ).toBe(0);
  });

  it("rejects invalid or cross-origin widget replacements without data loss", async () => {
    const original = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        type: WIDGET_TYPE.BLANK,
        position: { column: 0, row: 0 },
        size: {
          columns: BLANK_WIDGET_SIZE.DEFAULT_COLUMNS,
          rows: BLANK_WIDGET_SIZE.DEFAULT_ROWS,
        },
      },
    ];
    expect((await saveWidgets(original)).status).toBe(HTTP_STATUS.OK);

    const collision = await saveWidgets([
      ...original,
      {
        id: "00000000-0000-4000-8000-000000000002",
        type: WIDGET_TYPE.BLANK,
        position: { column: 2, row: 1 },
        size: {
          columns: BLANK_WIDGET_SIZE.DEFAULT_COLUMNS,
          rows: BLANK_WIDGET_SIZE.DEFAULT_ROWS,
        },
      },
    ]);
    expect(collision.status).toBe(HTTP_STATUS.BAD_REQUEST);

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
    await expect(stored.json()).resolves.toEqual({ items: original });
  });
});

function uploadFile(name: string, content: string): Promise<Response> {
  const bytes = new TextEncoder().encode(content);
  const query = new URLSearchParams({ [API_QUERY_PARAMETERS.FILE_NAME]: name });
  return SELF.fetch(`${ORIGIN}${API_PATHS.FILES}?${query}`, {
    method: HTTP_METHOD.POST,
    headers: {
      [HTTP_HEADERS.CONTENT_TYPE]: TEST_MEDIA_TYPE.TEXT,
      [HTTP_HEADERS.FILE_SIZE]: String(bytes.byteLength),
      [HTTP_HEADERS.ORIGIN]: ORIGIN,
    },
    body: bytes,
  });
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
