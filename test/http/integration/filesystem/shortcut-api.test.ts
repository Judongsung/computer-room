import { env, SELF } from "cloudflare:test";
import { beforeEach, expect, it } from "vitest";
import { API_PATH_SEGMENTS, FILESYSTEM_API_PATHS, GUEST_ACCESS_API_PATHS } from "@/constants/platform/api";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { HTTP_METHOD } from "@/constants/platform/http";
import { ORIGIN, jsonRequest, resetWorkerState, uploadFile } from "@test/support/http/worker-api-harness";

beforeEach(resetWorkerState);

it("creates and resolves a private shortcut and deletes only its metadata", async () => {
  const response = await uploadFile("original.txt", "original content");
  const { file } = await response.json() as { file: { id: string } };
  const created = await jsonRequest(FILESYSTEM_API_PATHS.SHORTCUTS, HTTP_METHOD.POST, {
    targetEntryId: file.id, parentId: FILESYSTEM_ROOT_ID.DESKTOP, name: "My file",
    desktopTargetIndex: 0, desktopCapacity: 20,
  });
  expect(created.status).toBe(200);
  const { entry } = await created.json() as { entry: { id: string } };
  const targetUrl = `${ORIGIN}${FILESYSTEM_API_PATHS.SHORTCUTS}/${entry.id}/${API_PATH_SEGMENTS.TARGET}`;
  expect(await (await SELF.fetch(targetUrl)).json()).toMatchObject({ entry: { id: file.id, kind: "file" } });
  const published = await jsonRequest(`${GUEST_ACCESS_API_PATHS.ENTRIES}/${entry.id}`, HTTP_METHOD.PUT, { published: true });
  expect(published.status).toBe(400);
  const objects = (await env.FILES.list()).objects.map((object) => object.key);
  await jsonRequest(`${FILESYSTEM_API_PATHS.ENTRIES}/${entry.id}`, HTTP_METHOD.DELETE, {});
  const deleted = await jsonRequest(`${FILESYSTEM_API_PATHS.TRASH}/${entry.id}`, HTTP_METHOD.DELETE, {});
  expect(deleted.status).toBe(204);
  expect((await env.FILES.list()).objects.map((object) => object.key)).toEqual(objects);
  expect(await env.DB.prepare("SELECT id FROM filesystem_entries WHERE id = ?1").bind(file.id).first()).not.toBeNull();
});
