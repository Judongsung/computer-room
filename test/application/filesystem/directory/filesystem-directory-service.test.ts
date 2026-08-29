import { describe, expect, it } from "vitest";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import {
  DEFAULT_FILESYSTEM_DIRECTORY_SORT,
  FILESYSTEM_SORT_DIRECTION,
  FILESYSTEM_SORT_FIELD,
} from "@/constants/filesystem/sort";
import { createFilesystemApplicationFixture } from "@test/support/filesystem/filesystem-application-fixture";
import { filesystemEntryRecord } from "@test/support/filesystem/filesystem-entry-record";
import { streamFromText } from "@test/support/platform/runtime-fakes";

describe("filesystem directory use cases", () => {
  it("lists nested folders with breadcrumbs and rejects a missing parent", async () => {
    const { directories } = createFilesystemApplicationFixture();
    const parent = await directories.createDirectory(null, "사진");
    await directories.createDirectory(parent.id, "여행");

    const root = await directories.listDirectory(null, 0, 50);
    const nested = await directories.listDirectory(parent.id, 0, 50);

    expect(root.items.map((entry) => entry.name)).toContain("사진");
    expect(nested.breadcrumbs.map((entry) => entry.name)).toEqual([
      "내 문서",
      "사진",
    ]);
    expect(nested.items.map((entry) => entry.name)).toEqual(["여행"]);
    await expect(
      directories.createDirectory("missing-parent", "고아 폴더"),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND.code,
    });
  });

  it("numbers directory names without case", async () => {
    const { directories } = createFilesystemApplicationFixture();

    const first = await directories.createDirectory(null, "Archive");
    const second = await directories.createDirectory(null, "archive");

    expect(first.name).toBe("Archive");
    expect(second.name).toBe("archive (2)");
  });

  it("paginates folders before files in the stored sort order", async () => {
    const { directories, files } = createFilesystemApplicationFixture();
    await directories.createDirectory(null, "나 폴더");
    await directories.createDirectory(null, "가 폴더");
    await files.uploadFile({
      originalName: "가 파일.txt",
      contentType: "text/plain",
      declaredSize: 1,
      body: streamFromText("1"),
    });

    const first = await directories.listDirectory(null, 0, 2);
    const second = await directories.listDirectory(
      null,
      first.nextOffset ?? 0,
      2,
    );

    expect(first.items.map((entry) => entry.name)).toEqual([
      "가 폴더",
      "나 폴더",
    ]);
    expect(first.nextOffset).toBe(2);
    expect(second.items.map((entry) => entry.name)).toEqual(["가 파일.txt"]);
    expect(second.nextOffset).toBeNull();
  });

  it("persists one folder sort and keeps ordering stable across pages", async () => {
    const { directories, repository } = createFilesystemApplicationFixture({
      ids: [],
    });
    for (let size = 1; size <= 105; size += 1) {
      const id = `file-${String(size).padStart(3, "0")}`;
      repository.records.set(
        id,
        filesystemEntryRecord(id, FILESYSTEM_ENTRY_KIND.FILE, `${id}.bin`, {
          size,
          contentType: "application/octet-stream",
        }),
      );
    }
    const sort = {
      field: FILESYSTEM_SORT_FIELD.SIZE,
      direction: FILESYSTEM_SORT_DIRECTION.DESCENDING,
    } as const;

    await expect(
      directories.updateDirectorySort(FILESYSTEM_ROOT_ID.DOCUMENTS, sort),
    ).resolves.toEqual(sort);
    const first = await directories.listDirectory(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      0,
      100,
    );
    const second = await directories.listDirectory(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      first.nextOffset ?? 0,
      100,
    );

    expect(first.sort).toEqual(sort);
    expect(first.nextOffset).toBe(100);
    expect(second.nextOffset).toBeNull();
    expect([...first.items, ...second.items].map((entry) => entry.id)).toEqual(
      Array.from(
        { length: 105 },
        (_, index) => `file-${String(105 - index).padStart(3, "0")}`,
      ),
    );
    await expect(
      directories.listDirectory(FILESYSTEM_ROOT_ID.DESKTOP, 0, 100),
    ).resolves.toMatchObject({ sort: DEFAULT_FILESYSTEM_DIRECTORY_SORT });
  });

  it("rejects a new desktop directory when every slot is occupied", async () => {
    const { directories } = createFilesystemApplicationFixture();
    await directories.createDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "첫 번째", {
      targetIndex: 0,
      capacity: 2,
    });
    await directories.createDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "두 번째", {
      targetIndex: 1,
      capacity: 2,
    });

    await expect(
      directories.createDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "세 번째", {
        targetIndex: 2,
        capacity: 2,
      }),
    ).rejects.toMatchObject({ code: FILESYSTEM_ERRORS.DESKTOP_FULL.code });
  });
});
