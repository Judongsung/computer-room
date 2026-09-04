import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { API_PATHS, API_PATH_SEGMENTS } from "@/constants/platform/api";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { HTTP_HEADERS, HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { WIDGET_TYPE, WIDGET_WINDOW_POLICY } from "@/constants/widgets/widget";
import type { DashboardWidget } from "@/types/widgets/widget";
import type { StorageStatusSnapshot } from "@/types/storage/storage-status";
import { ORIGIN, jsonRequest, resetWorkerState, widgetPath } from "@test/support/http/worker-api-harness";

beforeEach(resetWorkerState);

describe("computer-room storage API", () => {
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
});
