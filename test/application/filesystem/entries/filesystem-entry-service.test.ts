import { describe, expect, it } from "vitest";
import { FILE_OBJECT_KEY_PREFIX } from "@/constants/filesystem/file";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { thumbnailObjectKey } from "@/domain/filesystem/thumbnail";
import { createFilesystemApplicationFixture } from "@test/support/filesystem/filesystem-application-fixture";
import { streamFromText } from "@test/support/platform/runtime-fakes";

describe("filesystem entry use cases", () => {
  it("protects system roots and rejects moving a directory into its descendant", async () => {
    const { directories, entries } = createFilesystemApplicationFixture();
    const parent = await directories.createDirectory(null, "사진");
    const child = await directories.createDirectory(parent.id, "여행");

    await expect(
      entries.updateEntry(parent.id, { parentId: child.id }),
    ).rejects.toMatchObject({ code: FILESYSTEM_ERRORS.DIRECTORY_CYCLE.code });
    await expect(
      entries.updateEntry(FILESYSTEM_ROOT_ID.DOCUMENTS, { name: "문서" }),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERRORS.SYSTEM_ENTRY_PROTECTED.code,
    });
  });

  it("renames and moves metadata without changing the R2 object key", async () => {
    const { directories, entries, files, repository, storage } =
      createFilesystemApplicationFixture();
    const folder = await directories.createDirectory(null, "문서함");
    const target = await directories.createDirectory(null, "보관함");
    const file = await files.uploadFile({
      parentId: folder.id,
      originalName: "기록.txt",
      contentType: "text/plain",
      declaredSize: 4,
      body: streamFromText("test"),
    });
    const objectKey = `${FILE_OBJECT_KEY_PREFIX}/${file.id}`;
    const thumbnailKey = thumbnailObjectKey(file.id);
    await storage.put(thumbnailKey, streamFromText("thumb"), "image/webp");

    const moved = await entries.updateEntry(file.id, {
      parentId: target.id,
      name: "기록-완료.txt",
    });

    expect(moved).toMatchObject({
      parentId: target.id,
      name: "기록-완료.txt",
    });
    expect(repository.records.get(file.id)?.objectKey).toBe(objectKey);
    expect(storage.objects.has(objectKey)).toBe(true);
    expect(storage.objects.has(thumbnailKey)).toBe(true);
  });

  it("swaps occupied desktop positions", async () => {
    const { directories, entries, repository } = createFilesystemApplicationFixture();
    const first = await directories.createDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "첫 번째",
      { targetIndex: 0, capacity: 2 },
    );
    const second = await directories.createDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "두 번째",
      { targetIndex: 1, capacity: 2 },
    );

    await entries.moveEntry(first.id, {
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      desktopPlacement: { targetIndex: 1, capacity: 2 },
    });

    await expect(repository.listDesktopEntryIds()).resolves.toEqual([
      second.id,
      first.id,
    ]);
    expect(repository.records.get(second.id)?.desktopOrder).toBe(0);
    expect(repository.records.get(first.id)?.desktopOrder).toBe(1);
  });

  it("reorders a selected desktop group without changing its relative order", async () => {
    const { directories, entries, repository } = createFilesystemApplicationFixture();
    const first = await directories.createDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "첫 번째",
      { targetIndex: 0, capacity: 4 },
    );
    const second = await directories.createDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "두 번째",
      { targetIndex: 1, capacity: 4 },
    );
    const third = await directories.createDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "세 번째",
      { targetIndex: 2, capacity: 4 },
    );
    const fourth = await directories.createDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "네 번째",
      { targetIndex: 3, capacity: 4 },
    );

    const result = await entries.moveEntries([third.id, second.id], {
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      desktopPlacement: { targetIndex: 0, capacity: 4 },
    });

    expect(result.failures).toEqual([]);
    expect(result.succeededIds).toEqual([third.id, second.id]);
    await expect(repository.listDesktopEntryIds()).resolves.toEqual([
      second.id,
      third.id,
      first.id,
      fourth.id,
    ]);
  });

  it("returns per-entry failures while preserving successful moves", async () => {
    const { directories, entries, repository } = createFilesystemApplicationFixture();
    const target = await directories.createDirectory(null, "대상");
    const folder = await directories.createDirectory(null, "이동할 폴더");

    const result = await entries.moveEntries([folder.id, "missing"], {
      parentId: target.id,
    });

    expect(result.succeededIds).toEqual([folder.id]);
    expect(result.failures).toEqual([
      expect.objectContaining({
        id: "missing",
        code: FILESYSTEM_ERRORS.ENTRY_NOT_FOUND.code,
      }),
    ]);
    expect(repository.records.get(folder.id)?.parentId).toBe(target.id);
  });

  it("requires the placement-aware contract when entering the desktop", async () => {
    const { directories, entries } = createFilesystemApplicationFixture();
    const folder = await directories.createDirectory(null, "옮길 폴더");

    await expect(
      entries.updateEntry(folder.id, {
        parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      }),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERRORS.INVALID_DESKTOP_PLACEMENT.code,
    });
  });
});
