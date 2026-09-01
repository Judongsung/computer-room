import { describe, expect, it } from "vitest";
import { assembleFilesystemDirectoryPage } from "@/application/filesystem/directory/filesystem-directory-page";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import { filesystemEntryRecord } from "@test/support/filesystem/filesystem-entry-record";

describe("filesystem directory page", () => {
  it("maps a visibility-scoped lookahead page without changing its order", () => {
    const directory = filesystemEntryRecord(
      "directory",
      FILESYSTEM_ENTRY_KIND.DIRECTORY,
      "공개 폴더",
      { parentId: null },
    );
    const first = filesystemEntryRecord(
      "first",
      FILESYSTEM_ENTRY_KIND.FILE,
      "첫째.txt",
    );
    const lookahead = filesystemEntryRecord(
      "lookahead",
      FILESYSTEM_ENTRY_KIND.FILE,
      "둘째.txt",
    );

    const page = assembleFilesystemDirectoryPage({
      directory,
      breadcrumbs: [{ id: directory.id, name: directory.name }],
      entries: [first, lookahead],
      offset: 100,
      limit: 1,
      sort: DEFAULT_FILESYSTEM_DIRECTORY_SORT,
    });

    expect(page.items.map(({ id }) => id)).toEqual([first.id]);
    expect(page.nextOffset).toBe(101);
    expect(page.directory.id).toBe(directory.id);
  });
});
