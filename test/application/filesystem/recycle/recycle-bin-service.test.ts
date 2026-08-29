import { describe, expect, it } from "vitest";
import { FILE_OBJECT_KEY_PREFIX } from "@/constants/filesystem/file";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import { thumbnailObjectKey } from "@/domain/filesystem/thumbnail";
import { createFilesystemApplicationFixture } from "@test/support/filesystem/filesystem-application-fixture";
import { streamFromText } from "@test/support/platform/runtime-fakes";

describe("recycle bin use cases", () => {
  it("protects system roots from trash moves", async () => {
    const { filesystem } = createFilesystemApplicationFixture();

    await expect(
      filesystem.trashEntry(FILESYSTEM_ROOT_ID.RECYCLE_BIN),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERRORS.SYSTEM_ENTRY_PROTECTED.code,
    });
  });

  it("moves a subtree to trash, restores with a numbered name, and purges R2 files", async () => {
    const { filesystem, files, recycleBin, repository, storage, clock } =
      createFilesystemApplicationFixture();
    const folder = await filesystem.createDirectory(null, "보관함");
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

    await filesystem.trashEntry(folder.id);
    expect(storage.objects.has(objectKey)).toBe(true);
    expect(storage.objects.has(thumbnailKey)).toBe(true);
    clock.timestamp += 1;
    await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "보관함");
    const restored = await recycleBin.restoreEntry(folder.id);
    expect(restored.name).toBe("보관함 (2)");

    await filesystem.trashEntry(folder.id);
    await recycleBin.permanentlyDeleteEntry(folder.id);
    expect(storage.objects.has(objectKey)).toBe(false);
    expect(storage.objects.has(thumbnailKey)).toBe(false);
    expect(repository.records.has(folder.id)).toBe(false);
    expect(repository.records.has(file.id)).toBe(false);
  });

  it("keeps trash metadata when R2 deletion fails", async () => {
    const { filesystem, files, recycleBin, repository, storage } =
      createFilesystemApplicationFixture();
    const file = await files.uploadFile({
      originalName: "keep.txt",
      contentType: "text/plain",
      declaredSize: 4,
      body: streamFromText("test"),
    });
    await filesystem.trashEntry(file.id);
    storage.failOnDelete = true;

    await expect(recycleBin.permanentlyDeleteEntry(file.id)).rejects.toThrow(
      "Storage delete failure",
    );
    expect(repository.records.has(file.id)).toBe(true);
  });

  it("restores to My Documents when the original parent remains in trash", async () => {
    const { filesystem, recycleBin } = createFilesystemApplicationFixture();
    const parent = await filesystem.createDirectory(null, "부모");
    const child = await filesystem.createDirectory(parent.id, "자식");

    await filesystem.trashEntry(child.id);
    await filesystem.trashEntry(parent.id);
    const restored = await recycleBin.restoreEntry(child.id);

    expect(restored.parentId).toBe(FILESYSTEM_ROOT_ID.DOCUMENTS);
  });

  it("empties every trash root and its R2 objects", async () => {
    const { files, filesystem, recycleBin, repository, storage } =
      createFilesystemApplicationFixture();
    const first = await files.uploadFile({
      originalName: "first.txt",
      contentType: "text/plain",
      declaredSize: 1,
      body: streamFromText("1"),
    });
    const second = await files.uploadFile({
      originalName: "second.txt",
      contentType: "text/plain",
      declaredSize: 1,
      body: streamFromText("2"),
    });
    await filesystem.trashEntry(first.id);
    await filesystem.trashEntry(second.id);

    await recycleBin.emptyTrash();

    expect(repository.records.has(first.id)).toBe(false);
    expect(repository.records.has(second.id)).toBe(false);
    expect(storage.objects.size).toBe(0);
  });

  it("returns per-entry failures while preserving successful trash and restore changes", async () => {
    const { filesystem, recycleBin, repository } =
      createFilesystemApplicationFixture();
    const folder = await filesystem.createDirectory(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "묶음 작업",
    );

    const trashed = await filesystem.trashEntries([folder.id, "missing"]);
    expect(trashed.succeededIds).toEqual([folder.id]);
    expect(trashed.failures).toEqual([
      expect.objectContaining({
        id: "missing",
        code: FILESYSTEM_ERRORS.ENTRY_NOT_FOUND.code,
      }),
    ]);
    expect(repository.records.get(folder.id)?.trashedAt).not.toBeNull();

    const restored = await recycleBin.restoreEntries([folder.id, "missing"]);
    expect(restored.succeededIds).toEqual([folder.id]);
    expect(restored.failures).toEqual([
      expect.objectContaining({
        id: "missing",
        code: FILESYSTEM_ERRORS.ENTRY_NOT_TRASHED.code,
      }),
    ]);
    expect(repository.records.get(folder.id)?.trashedAt).toBeNull();
  });

  it("returns every widget closed by a subtree trash move", async () => {
    const { filesystem, repository, clock } =
      createFilesystemApplicationFixture();
    const folder = await filesystem.createDirectory(null, "위젯 폴더");
    await repository.insertWidget({
      id: "widget-entry",
      widgetId: "widget-id",
      widgetType: WIDGET_TYPE.MEMO,
      parentId: folder.id,
      name: "메모",
      nameKey: filesystemNameKey("메모"),
      createdAt: clock.now(),
    });

    const result = await filesystem.trashEntry(folder.id);

    expect(result.closedWidgetIds).toEqual(["widget-id"]);
    expect(repository.records.get(folder.id)).toMatchObject({
      restoreParentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      restorePath: "내 문서",
    });
  });

  it("keeps a desktop item in trash when its original slot is occupied", async () => {
    const { filesystem, recycleBin, repository } =
      createFilesystemApplicationFixture();
    const trashed = await filesystem.createDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "복원할 폴더",
      { targetIndex: 0, capacity: 1 },
    );
    await filesystem.trashEntry(trashed.id);
    await filesystem.createDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "새 폴더",
      { targetIndex: 0, capacity: 1 },
    );

    await expect(
      recycleBin.restoreEntry(trashed.id, {
        desktopPlacement: { targetIndex: 0, capacity: 1 },
      }),
    ).rejects.toMatchObject({ code: FILESYSTEM_ERRORS.DESKTOP_FULL.code });
    expect(repository.records.get(trashed.id)?.trashedAt).not.toBeNull();
  });
});
