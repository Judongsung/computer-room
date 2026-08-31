import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  API_PATHS,
  API_PATH_SEGMENTS,
} from "@/constants/platform/api";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { WIDGET_ERRORS } from "@/constants/widgets/errors/widget";
import { WIDGET_TYPE, WIDGET_WINDOW_POLICY } from "@/constants/widgets/widget";
import type { DashboardWidget } from "@/types/widgets/widget";
import {
  ORIGIN,
  jsonRequest,
  resetWorkerState,
  widgetPath,
} from "@test/support/http/worker-api-harness";

beforeEach(resetWorkerState);

describe("administrator application API", () => {
  it("keeps one instance without restoring open state or allowing file storage", async () => {
    const type = WIDGET_TYPE.ADMIN;
    const policy = WIDGET_WINDOW_POLICY[type];
    const input = {
      type,
      position: { x: 96, y: 80 },
      size: { width: policy.DEFAULT_WIDTH, height: policy.DEFAULT_HEIGHT },
    };

    const firstResponse = await jsonRequest(
      API_PATHS.WIDGETS,
      HTTP_METHOD.POST,
      input,
    );
    expect(firstResponse.status).toBe(HTTP_STATUS.CREATED);
    const first = (await firstResponse.json()) as { widget: DashboardWidget };
    expect(first.widget).toMatchObject({ type, file: null, data: null });
    expect(await storedOpenState(first.widget.id)).toBe(0);
    await expect(listOpenApplications()).resolves.toEqual({ items: [] });

    const duplicateResponse = await jsonRequest(
      API_PATHS.WIDGETS,
      HTTP_METHOD.POST,
      input,
    );
    expect(duplicateResponse.status).toBe(HTTP_STATUS.OK);
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      widget: { id: first.widget.id, type, file: null, data: null },
    });
    expect(
      (
        await jsonRequest(
          `${widgetPath(first.widget.id)}/${API_PATH_SEGMENTS.FILE}`,
          HTTP_METHOD.POST,
          { parentId: FILESYSTEM_ROOT_ID.DOCUMENTS, name: "관리자" },
        )
      ).status,
    ).toBe(WIDGET_ERRORS.WIDGET_FILE_NOT_SUPPORTED.status);

    expect(
      (
        await jsonRequest(
          `${widgetPath(first.widget.id)}/${API_PATH_SEGMENTS.CLOSE}`,
          HTTP_METHOD.POST,
          {},
        )
      ).status,
    ).toBe(HTTP_STATUS.NO_CONTENT);
    await expect(listOpenApplications()).resolves.toEqual({ items: [] });
  });
});

async function storedOpenState(id: string): Promise<number | null> {
  return env.DB
    .prepare("SELECT is_open FROM dashboard_widgets WHERE id = ?1")
    .bind(id)
    .first<number>("is_open");
}

async function listOpenApplications(): Promise<unknown> {
  return (await SELF.fetch(`${ORIGIN}${API_PATHS.WIDGETS}`)).json();
}
