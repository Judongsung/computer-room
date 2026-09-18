import { describe, expect, it, vi } from "vitest";
import { FilesystemSearchService } from "@/application/filesystem/search/filesystem-search-service";
import { ActiveFilesystemEntryResolver } from "@/application/filesystem/policies/active-filesystem-entry-resolver";
import { normalizeSearchQuery } from "@/domain/filesystem/search/search-query";
import { MAX_FILE_NAME_BYTES } from "@/constants/filesystem/file";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { createFilesystemApplicationFixture } from "@test/support/filesystem/filesystem-application-fixture";
import { filesystemEntryRecord } from "@test/support/filesystem/filesystem-entry-record";

describe("filesystem name search", () => {
  it("normalizes complete literal queries and rejects empty or oversized input", () => {
    expect(normalizeSearchQuery("  한 Report_%  ")).toBe("한 report_%");
    expect(() => normalizeSearchQuery("  ")).toThrow();
    expect(() => normalizeSearchQuery("가".repeat(MAX_FILE_NAME_BYTES))).toThrow();
  });

  it("passes normalized filters and one extra row to the repository and maps public entries", async () => {
    const fixture = createFilesystemApplicationFixture();
    const rows = ["a", "b"].map((id) => ({ entry: filesystemEntryRecord(id, "file", id), parentPath: "내 문서" }));
    const search = vi.fn(async () => rows);
    const service = new FilesystemSearchService({ search }, new ActiveFilesystemEntryResolver(fixture.repository));
    const page = await service.search({ q: " A ", kind: "all", directoryId: FILESYSTEM_ROOT_ID.DOCUMENTS }, 0, 1);
    expect(search).toHaveBeenCalledExactlyOnceWith({ q: "a", kind: "all", directoryId: FILESYSTEM_ROOT_ID.DOCUMENTS }, 0, 2);
    expect(page).toMatchObject({ items: [{ entry: { id: "a" }, parentPath: "내 문서" }], nextOffset: 1 });
    expect(page.items[0]?.entry).not.toHaveProperty("objectKey");
  });

  it("rejects missing and trashed scopes before searching", async () => {
    const fixture = createFilesystemApplicationFixture();
    const folder = await fixture.directories.createDirectory(null, "archive");
    await fixture.recycleBin.trashEntry(folder.id);
    const search = vi.fn(async () => []);
    const service = new FilesystemSearchService({ search }, new ActiveFilesystemEntryResolver(fixture.repository));
    for (const directoryId of [folder.id, "missing"]) {
      await expect(service.search({ q: "file", kind: "all", directoryId }, 0, 10)).rejects.toThrow();
    }
    expect(search).not.toHaveBeenCalled();
  });
});
