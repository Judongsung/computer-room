import { afterEach, expect, it, vi } from "vitest";
import { FilesystemApiClient } from "@client/api/filesystem/filesystem-api-client";
import { FILESYSTEM_API_PATHS } from "@/constants/platform/api";
import { fileEntry } from "@test/support/filesystem/file-entry";

const api = new FilesystemApiClient();
afterEach(() => vi.unstubAllGlobals());

it("encodes literal search criteria and validates the result envelope", async () => {
  const page = {
    items: [{ entry: fileEntry("one", "한%_&.txt", "text/plain"), parentPath: "내 문서", contentMatch: { excerpt: "file body" } }],
    nextOffset: 37,
  };
  const fetcher = vi.fn().mockResolvedValue(Response.json(page));
  vi.stubGlobal("fetch", fetcher);
  await expect(api.search({ q: "한%_&", kind: "file", mode: "content", directoryId: "folder" }, 17)).resolves.toEqual(page);
  const url = new URL(fetcher.mock.calls[0]![0], "http://localhost");
  expect(url.pathname).toBe(FILESYSTEM_API_PATHS.SEARCH);
  expect(Object.fromEntries(url.searchParams)).toEqual({
    q: "한%_&", kind: "file", mode: "content", directoryId: "folder", offset: "17",
  });
});

it.each([
  { items: [{ entry: {}, parentPath: "folder", contentMatch: null }], nextOffset: null },
  { items: [{ entry: fileEntry("one", "file", "text/plain") }], nextOffset: null },
  { items: [], nextOffset: -1 },
  { items: [{ entry: fileEntry("one", "file", "text/plain"), parentPath: "folder" }], nextOffset: null },
  { items: [{ entry: fileEntry("one", "file", "text/plain"), parentPath: "folder", contentMatch: { excerpt: 1 } }], nextOffset: null },
])("rejects malformed search responses", async (page) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(page)));
  await expect(api.search({ q: "file", kind: "all" })).rejects.toThrow();
});

it("accepts name-only results without restricting content matches to program entries", async () => {
  const page = { items: [{ entry: fileEntry("one", "file", "text/plain"), parentPath: "folder", contentMatch: null }], nextOffset: null };
  const fetcher = vi.fn().mockResolvedValue(Response.json(page));
  vi.stubGlobal("fetch", fetcher);
  await expect(api.search({ q: "file", kind: "all" })).resolves.toEqual(page);
  expect(new URL(fetcher.mock.calls[0]![0], "http://localhost").searchParams.has("mode")).toBe(false);
});
