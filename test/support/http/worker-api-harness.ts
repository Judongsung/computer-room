import { env, SELF } from "cloudflare:test";
import { expect } from "vitest";
import { API_PATHS, API_PATH_SEGMENTS, API_QUERY_PARAMETERS, FILESYSTEM_API_PATHS, NOVELAI_IMAGE_UPLOAD_API_PATH } from "@/constants/platform/api";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { HTTP_HEADERS, HTTP_MEDIA_TYPE, HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { WIDGET_TYPE, WIDGET_WINDOW_POLICY } from "@/constants/widgets/widget";
import type { DashboardWidget, WidgetLayout, WidgetType } from "@/types/widgets/widget";

export const ORIGIN = "http://localhost";
export const TEST_MEDIA_TYPE = {
  IMAGE: "image/png",
  TEXT: "text/plain",
  VIDEO: "video/mp4",
} as const;
export const MEMO_WINDOW_POLICY = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];
export const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export async function resetWorkerState(): Promise<void> {
  await env.DB
    .prepare(
      "UPDATE mobile_preferences SET wallpaper_entry_id = NULL WHERE singleton_id = 1",
    )
    .run();
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
}

export function uploadFile(
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
  return SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.FILES}?${query}`, {
    method: HTTP_METHOD.POST,
    headers: {
      [HTTP_HEADERS.CONTENT_TYPE]: contentType,
      [HTTP_HEADERS.FILE_SIZE]: String(bytes.byteLength),
      [HTTP_HEADERS.ORIGIN]: ORIGIN,
    },
    body: bytes,
  });
}

export function uploadNovelAiImage(
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

export async function decodeResponseBody(response: Response): Promise<string> {
  return new TextDecoder().decode(await response.arrayBuffer());
}

export function saveWidgets(items: unknown[]): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`, {
    method: HTTP_METHOD.PUT,
    headers: {
      [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON,
      [HTTP_HEADERS.ORIGIN]: ORIGIN,
    },
    body: JSON.stringify({ items }),
  });
}

export async function createWidget(
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

export function discardWidget(widgetId: string): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${widgetPath(widgetId)}`, {
    method: HTTP_METHOD.DELETE,
    headers: { [HTTP_HEADERS.ORIGIN]: ORIGIN },
  });
}

export function toLayout(widget: DashboardWidget): WidgetLayout {
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

export function widgetPath(widgetId: string): string {
  return `${API_PATHS.WIDGETS}/${widgetId}`;
}

export function checklistPath(widgetId: string): string {
  return `${widgetPath(widgetId)}/${API_PATH_SEGMENTS.CHECKLIST}`;
}

export function jsonRequest(
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
