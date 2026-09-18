import { env, SELF } from "cloudflare:test";
import { beforeEach, expect, it, vi } from "vitest";
import { FILESYSTEM_API_PATHS, API_PATHS } from "@/constants/platform/api";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { HTTP_METHOD } from "@/constants/platform/http";
import { D1FilesystemSearchRepository } from "@/infrastructure/filesystem/search/d1-filesystem-search-repository";
import type { FilesystemSearchPage } from "@/types/filesystem/search/search";
import { ORIGIN, jsonRequest, resetWorkerState, uploadFile } from "@test/support/http/worker-api-harness";

beforeEach(resetWorkerState);

it("searches active subtrees with literal matching, stable pages, kinds and parent paths", async () => {
  const folder = await createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "Report folder");
  const child = await createDirectory(folder, "nested");
  const first = await upload("Report_% 한.txt", child);
  const second = await upload("Report_% 한.txt", FILESYSTEM_ROOT_ID.DESKTOP);
  await upload("Report-other.txt", folder);
  await upload("Report_% hidden.txt", child);
  const trashed = await createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "trashed");
  await upload("Report_% trash.txt", trashed);
  await jsonRequest(`${FILESYSTEM_API_PATHS.ENTRIES}/${trashed}`, HTTP_METHOD.DELETE, {});
  await env.DB.prepare("UPDATE files SET status = 'pending' WHERE original_name = ?1").bind("Report_% hidden.txt").run();

  const response = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.SEARCH}?q=REPORT_%25&limit=1`);
  expect(response.status).toBe(200);
  const page = await response.json() as FilesystemSearchPage;
  const next = await search("REPORT_%", { offset: String(page.nextOffset), limit: "1" });
  expect([...page.items, ...next.items].map((item) => item.entry.id)).toEqual([first, second].sort());
  expect(page.nextOffset).toBe(1);
  expect(next.nextOffset).toBeNull();
  const scoped = await search("report", { directoryId: folder, kind: "file" });
  expect(scoped.items).toHaveLength(2);
  expect(scoped.items.find((item) => item.entry.id === first)?.parentPath).toBe("내 문서/Report folder/nested");
  const document = await jsonRequest(API_PATHS.WIDGET_FILES, HTTP_METHOD.POST, {
    type: WIDGET_TYPE.MEMO, parentId: child, name: "Report memo", data: { markdown: "private body" },
  });
  const { entry: program } = await document.json() as { entry: { id: string } };
  const programs = await search("report", { kind: "widget", directoryId: folder });
  expect(programs.items.map((item) => item.entry.id)).toEqual([program.id]);
  expect(JSON.stringify(programs)).not.toContain("private body");
  expect((await search("report", { kind: "directory" })).items.map((item) => item.entry.id)).toEqual([folder]);
  expect((await search("내 문서")).items).toEqual([]);
  expect((await search("한")).items).toHaveLength(2);

  const prepare = vi.spyOn(env.DB, "prepare");
  await new D1FilesystemSearchRepository(env.DB).search({ q: "report", kind: "all" }, 0, 10);
  expect(prepare).toHaveBeenCalledOnce();
  prepare.mockRestore();
});

it("validates filters and scope without exposing trash descendants", async () => {
  for (const query of ["q=", "q=x&kind=unknown", "q=x&limit=0", "q=x&offset=-1"]) {
    const response = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.SEARCH}?${query}`);
    expect(response.status).toBe(400);
  }
  const missing = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.SEARCH}?q=x&directoryId=missing`);
  expect(missing.status).toBe(404);
  const folder = await createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "trashed");
  await jsonRequest(`${FILESYSTEM_API_PATHS.ENTRIES}/${folder}`, HTTP_METHOD.DELETE, {});
  const response = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.SEARCH}?q=x&directoryId=${folder}`);
  expect(response.status).toBe(409);
});

it("keeps search behind owner authentication", async () => {
  const response = await SELF.fetch(`https://private.example${FILESYSTEM_API_PATHS.SEARCH}?q=report`);
  expect(response.status).toBe(403);
});

async function createDirectory(parentId: string, name: string): Promise<string> {
  const response = await jsonRequest(FILESYSTEM_API_PATHS.DIRECTORIES, HTTP_METHOD.POST, { parentId, name });
  return (await response.json() as { directory: { id: string } }).directory.id;
}
async function upload(name: string, parentId: string): Promise<string> {
  return (await (await uploadFile(name, "body", parentId)).json() as { file: { id: string } }).file.id;
}
async function search(q: string, options: Record<string, string> = {}): Promise<FilesystemSearchPage> {
  const response = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.SEARCH}?${new URLSearchParams({ q, ...options })}`);
  expect(response.status).toBe(200);
  return response.json();
}
