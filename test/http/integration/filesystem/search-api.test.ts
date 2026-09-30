import { env, SELF } from "cloudflare:test";
import { beforeEach, expect, it, vi } from "vitest";
import { FILESYSTEM_API_PATHS, API_PATHS, API_PATH_SEGMENTS } from "@/constants/platform/api";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { HTTP_METHOD } from "@/constants/platform/http";
import { D1FilesystemSearchRepository } from "@/infrastructure/filesystem/search/d1-filesystem-search-repository";
import type { CreateWidgetFileInput, WidgetFileDocument } from "@/types/widgets/widget-file";
import type { FilesystemSearchPage } from "@/types/filesystem/search/search";
import { ORIGIN, jsonRequest, resetWorkerState, uploadFile, widgetPath } from "@test/support/http/worker-api-harness";
import { registerWorkerDatabaseSetup } from "@test/support/platform/worker-database";

registerWorkerDatabaseSetup();

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
  expect(programs.items[0]?.contentMatch).toBeNull();
  expect((await search("report", { kind: "directory" })).items.map((item) => item.entry.id)).toEqual([folder]);
  expect((await search("내 문서")).items).toEqual([]);
  expect((await search("한")).items).toHaveLength(2);

  const prepare = vi.spyOn(env.DB, "prepare");
  await new D1FilesystemSearchRepository(env.DB).search({ q: "report", kind: "all" }, 0, 10);
  expect(prepare).toHaveBeenCalledOnce();
  expect(prepare.mock.calls[0]?.[0]).not.toMatch(/memo_widgets|checklist_items/);
  prepare.mockRestore();
});

it("validates filters and scope without exposing trash descendants", async () => {
  for (const query of ["q=", "q=x&kind=unknown", "q=x&mode=unknown", "q=x&mode=", "q=x&limit=0", "q=x&offset=-1"]) {
    const response = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.SEARCH}?${query}`);
    expect(response.status).toBe(400);
  }
  const missing = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.SEARCH}?q=x&mode=all&directoryId=missing`);
  expect(missing.status).toBe(404);
  const folder = await createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "trashed");
  await jsonRequest(`${FILESYSTEM_API_PATHS.ENTRIES}/${folder}`, HTTP_METHOD.DELETE, {});
  const response = await SELF.fetch(`${ORIGIN}${FILESYSTEM_API_PATHS.SEARCH}?q=x&mode=content&directoryId=${folder}`);
  expect(response.status).toBe(409);
});

it.each(["name", "content", "all"])("keeps %s search behind owner authentication", async (mode) => {
  const response = await SELF.fetch(`https://private.example${FILESYSTEM_API_PATHS.SEARCH}?q=report&mode=${mode}`);
  expect(response.status).toBe(403);
  const guest = await SELF.fetch(`${ORIGIN}${API_PATHS.GUEST}/${API_PATH_SEGMENTS.FILESYSTEM}/${API_PATH_SEGMENTS.SEARCH}?q=report&mode=${mode}`);
  expect(guest.status).toBe(404);
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

it("searches current scoped bodies, deduplicates before pagination and excludes history and shortcuts", async () => {
  const folder = await createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "scope");
  const nested = await createDirectory(folder, "nested");
  const memo = await createProgram({ type: WIDGET_TYPE.MEMO, parentId: nested, name: "b needle", data: { markdown: "old-only" } });
  await jsonRequest(`${widgetPath(memo.widget.id)}/${API_PATH_SEGMENTS.MEMO}`, HTTP_METHOD.PUT, { markdown: "current NEEDLE" });
  const checklist = await createProgram({ type: WIDGET_TYPE.DAILY_CHECKLIST, parentId: folder, name: "a tasks", data: { items: [
    { label: "needle first", checked: true }, { label: "needle second", checked: false }, { label: "archived-only", checked: false },
    { label: "separate", checked: false }, { label: "words", checked: false },
  ] } });
  await env.DB.prepare("UPDATE checklist_items SET archived_at = 1 WHERE widget_id = ?1 AND label = ?2")
    .bind(checklist.widget.id, "archived-only").run();
  await createProgram({ type: WIDGET_TYPE.MEMO, parentId: FILESYSTEM_ROOT_ID.DESKTOP, name: "outside", data: { markdown: "needle" } });
  const trash = await createDirectory(folder, "trash");
  await createProgram({ type: WIDGET_TYPE.MEMO, parentId: trash, name: "hidden", data: { markdown: "needle" } });
  await jsonRequest(`${FILESYSTEM_API_PATHS.ENTRIES}/${trash}`, HTTP_METHOD.DELETE, {});
  const file = await upload("c needle.txt", folder);
  const shortcut = await jsonRequest(FILESYSTEM_API_PATHS.SHORTCUTS, HTTP_METHOD.POST, {
    targetEntryId: memo.entry.id, parentId: folder, name: "link",
  });
  expect(shortcut.status).toBe(200);
  const options = { mode: "content", directoryId: folder, limit: "1" };
  const first = await search("needle", options);
  expect(first.items.map(item => item.entry.id)).toEqual([checklist.entry.id]);
  expect(first.items[0]?.contentMatch).toEqual({ excerpt: "needle first" });
  expect(first.nextOffset).toBe(1);
  const second = await search("needle", { ...options, offset: "1" });
  expect(second.items.map(item => item.entry.id)).toEqual([memo.entry.id]);
  expect(second.nextOffset).toBeNull();
  const all = await search("needle", { mode: "all", directoryId: folder });
  expect(all.items.map(item => item.entry.id)).toEqual([checklist.entry.id, memo.entry.id, file]);
  expect(all.items[1]?.contentMatch).toEqual({ excerpt: "current NEEDLE" });
  expect(all.items[2]?.contentMatch).toBeNull();
  for (const q of ["old-only", "archived-only", "separate words"]) {
    expect((await search(q, options)).items).toEqual([]);
  }
  for (const kind of ["file", "directory", "shortcut"]) {
    expect((await search("needle", { ...options, kind })).items).toEqual([]);
  }
  expect((await search("needle", { ...options, kind: "widget", limit: "100" })).items).toHaveLength(2);
  const prepare = vi.spyOn(env.DB, "prepare");
  try {
    await new D1FilesystemSearchRepository(env.DB).search({ q: "needle", kind: "all", mode: "all", directoryId: folder }, 0, 10);
    expect(prepare).toHaveBeenCalledOnce();
  } finally { prepare.mockRestore(); }
});

it("matches raw markdown literally with ASCII-only folding and preserves unicode excerpts", async () => {
  const folder = FILESYSTEM_ROOT_ID.DOCUMENTS;
  const raw = "# Heading\n`CODE_%` [link](https://example.test/Path)\n한 가 É <b>text</b>";
  const memo = await createProgram({ type: WIDGET_TYPE.MEMO, parentId: folder, name: "plain", data: { markdown: raw } });
  for (const q of ["  code_%  ", "# heading", "https://example.test/path", "한", "가", "É", "<b>text</b>"]) {
    const page = await search(q, { mode: "content", directoryId: folder });
    expect(page.items.map(item => item.entry.id)).toEqual([memo.entry.id]);
    expect(page.items[0]?.contentMatch?.excerpt.toLowerCase()).toContain(q.trim().toLowerCase());
  }
  for (const q of ["code-x", "가", "é", "한"]) {
    expect((await search(q, { mode: "content", directoryId: folder })).items).toEqual([]);
  }
  const body = "😀".repeat(100) + "Needle" + "끝".repeat(400) + "Needle";
  await jsonRequest(`${widgetPath(memo.widget.id)}/${API_PATH_SEGMENTS.MEMO}`, HTTP_METHOD.PUT, { markdown: body });
  const page = await search("needle", { mode: "content", directoryId: folder });
  expect(page.items[0]?.contentMatch?.excerpt).toBe("…" + "😀".repeat(40) + "Needle" + "끝".repeat(274) + "…");
  expect(JSON.stringify(page)).not.toContain(body);
});

async function createProgram(input: CreateWidgetFileInput): Promise<WidgetFileDocument> {
  const response = await jsonRequest(API_PATHS.WIDGET_FILES, HTTP_METHOD.POST, input);
  expect(response.status).toBe(201);
  return response.json();
}
