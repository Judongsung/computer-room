import { SELF } from "cloudflare:test";
import { beforeEach, expect, it } from "vitest";
import { API_PATHS, API_PATH_SEGMENTS, FILESYSTEM_API_PATHS } from "@/constants/platform/api";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { MEMO_ERRORS } from "@/constants/widgets/errors/memo";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { ORIGIN, createWidget, jsonRequest, resetWorkerState, widgetPath } from "@test/support/http/worker-api-harness";

beforeEach(resetWorkerState);

it("lists memo version metadata and scopes historical bodies to their widget", async () => {
  const first = await createWidget(WIDGET_TYPE.MEMO, { x: 20, y: 20 });
  const second = await createWidget(WIDGET_TYPE.MEMO, { x: 40, y: 40 });
  const firstPath = `${widgetPath(first.id)}/${API_PATH_SEGMENTS.MEMO}`;
  const versionsPath = `${firstPath}/${API_PATH_SEGMENTS.VERSIONS}`;
  await jsonRequest(firstPath, HTTP_METHOD.PUT, { markdown: "private first" });
  await jsonRequest(firstPath, HTTP_METHOD.PUT, { markdown: "private second" });
  await jsonRequest(firstPath, HTTP_METHOD.PUT, { markdown: "private second" });
  const listResponse = await SELF.fetch(`${ORIGIN}${versionsPath}`);
  expect(listResponse.status).toBe(HTTP_STATUS.OK);
  const list = (await listResponse.json()) as { items: { version: number; savedAt: string | null }[] };
  expect(list.items.map(item => item.version)).toEqual([2, 1]);
  expect(list.items[0]?.savedAt).toEqual(expect.any(String));
  expect(JSON.stringify(list)).not.toContain("private");
  const firstVersion = await SELF.fetch(`${ORIGIN}${versionsPath}/1`);
  expect(firstVersion.status).toBe(HTTP_STATUS.OK);
  await expect(firstVersion.json()).resolves.toMatchObject({ version: 1, markdown: "private first" });
  const secondWidgetVersion = await SELF.fetch(
    `${ORIGIN}${widgetPath(second.id)}/${API_PATH_SEGMENTS.MEMO}/${API_PATH_SEGMENTS.VERSIONS}/1`,
  );
  expect(secondWidgetVersion.status).toBe(HTTP_STATUS.NOT_FOUND);
  await expect(secondWidgetVersion.json()).resolves.toMatchObject({ error: { code: MEMO_ERRORS.VERSION_NOT_FOUND.code } });
});

it("rejects malformed version numbers and unsupported methods", async () => {
  const memo = await createWidget(WIDGET_TYPE.MEMO, { x: 20, y: 20 });
  const path = `${widgetPath(memo.id)}/${API_PATH_SEGMENTS.MEMO}/${API_PATH_SEGMENTS.VERSIONS}`;
  for (const version of ["0", "-1", "1.1", "1e0", "9007199254740992", "nan"]) {
    const response = await SELF.fetch(`${ORIGIN}${path}/${version}`);
    expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
    await expect(response.json()).resolves.toMatchObject({ error: { code: MEMO_ERRORS.INVALID_VERSION.code } });
  }
  expect((await jsonRequest(path, HTTP_METHOD.POST, {})).status)
    .toBe(HTTP_STATUS.METHOD_NOT_ALLOWED);
});

it("keeps history through trash and restore, then cascades it on permanent deletion", async () => {
  const created = await jsonRequest(API_PATHS.WIDGET_FILES, HTTP_METHOD.POST, {
    type: WIDGET_TYPE.MEMO,
    parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
    name: "History memo",
    data: { markdown: "first" },
  });
  expect(created.status).toBe(HTTP_STATUS.CREATED);
  const document = (await created.json()) as { entry: { id: string }; widget: { id: string } };
  const versionPath = `${widgetPath(document.widget.id)}/${API_PATH_SEGMENTS.MEMO}/${API_PATH_SEGMENTS.VERSIONS}`;
  await jsonRequest(`${widgetPath(document.widget.id)}/${API_PATH_SEGMENTS.MEMO}`, HTTP_METHOD.PUT, { markdown: "second" });
  expect((await jsonRequest(`${FILESYSTEM_API_PATHS.ENTRIES}/${document.entry.id}`, HTTP_METHOD.DELETE, {})).status)
    .toBe(HTTP_STATUS.OK);
  expect((await SELF.fetch(`${ORIGIN}${versionPath}`)).status).toBe(HTTP_STATUS.OK);
  expect((await jsonRequest(`${FILESYSTEM_API_PATHS.TRASH}/${document.entry.id}/${API_PATH_SEGMENTS.RESTORE}`, HTTP_METHOD.POST, {})).status)
    .toBe(HTTP_STATUS.OK);
  const restored = await SELF.fetch(`${ORIGIN}${versionPath}`);
  await expect(restored.json()).resolves.toMatchObject({ items: [{ version: 2 }, { version: 1 }] });
  await jsonRequest(`${FILESYSTEM_API_PATHS.ENTRIES}/${document.entry.id}`, HTTP_METHOD.DELETE, {});
  const deleted = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.TRASH}/${document.entry.id}`, { method: HTTP_METHOD.DELETE, headers: { Origin: ORIGIN } });
  expect(deleted.status).toBe(HTTP_STATUS.NO_CONTENT);
  expect((await SELF.fetch(`${ORIGIN}${versionPath}`)).status).toBe(HTTP_STATUS.NOT_FOUND);
});
