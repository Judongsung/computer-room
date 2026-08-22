import { describe, expect, it } from "vitest";
import { FileService } from "../src/application/file-service";
import { FilesystemService } from "../src/application/filesystem-service";
import { RecycleBinService } from "../src/application/recycle-bin-service";
import { FILESYSTEM_ERRORS } from "../src/constants/errors/filesystem";
import { FILE_OBJECT_KEY_PREFIX } from "../src/constants/file";
import { FILESYSTEM_ROOT_ID } from "../src/constants/filesystem";
import {
  MemoryFileRepository,
  MemoryObjectStorage,
  SequenceIdGenerator,
  StaticClock,
  streamFromText,
} from "./fakes";

const IDS = [
  "entry-1",
  "entry-2",
  "entry-3",
  "entry-4",
  "entry-5",
  "entry-6",
  "entry-7",
  "entry-8",
] as const;

function createServices() {
  const repository = new MemoryFileRepository();
  const storage = new MemoryObjectStorage();
  const ids = new SequenceIdGenerator(IDS);
  const clock = new StaticClock(1_700_000_000_000);
  return {
    repository,
    storage,
    clock,
    filesystem: new FilesystemService(repository, ids, clock),
    files: new FileService(repository, storage, ids, clock),
    recycleBin: new RecycleBinService(repository, storage, clock),
  };
}

describe("filesystem use cases", () => {
  it("lists nested folders and rejects moving a directory into its descendant", async () => {
    const { filesystem } = createServices();
    const parent = await filesystem.createDirectory(null, "사진");
    const child = await filesystem.createDirectory(parent.id, "여행");

    const root = await filesystem.listDirectory(null, 0, 50);
    const nested = await filesystem.listDirectory(parent.id, 0, 50);
    expect(root.items.map((entry) => entry.name)).toContain("사진");
    expect(nested.breadcrumbs.map((entry) => entry.name)).toEqual(["내 문서", "사진"]);
    expect(nested.items.map((entry) => entry.name)).toEqual(["여행"]);
    await expect(
      filesystem.updateEntry(parent.id, { parentId: child.id }),
    ).rejects.toMatchObject({ code: FILESYSTEM_ERRORS.DIRECTORY_CYCLE.code });
    await expect(
      filesystem.createDirectory("missing-parent", "고아 폴더"),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND.code,
    });
  });

  it("protects system roots and numbers directory names without case", async () => {
    const { filesystem } = createServices();
    const first = await filesystem.createDirectory(null, "Archive");
    const second = await filesystem.createDirectory(null, "archive");

    expect(first.name).toBe("Archive");
    expect(second.name).toBe("archive (2)");
    await expect(
      filesystem.updateEntry(FILESYSTEM_ROOT_ID.DOCUMENTS, { name: "문서" }),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERRORS.SYSTEM_ENTRY_PROTECTED.code,
    });
    await expect(
      filesystem.trashEntry(FILESYSTEM_ROOT_ID.RECYCLE_BIN),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERRORS.SYSTEM_ENTRY_PROTECTED.code,
    });
  });

  it("paginates children with folders before files and names in order", async () => {
    const { filesystem, files } = createServices();
    await filesystem.createDirectory(null, "나 폴더");
    await filesystem.createDirectory(null, "가 폴더");
    await files.uploadFile({
      originalName: "가 파일.txt",
      contentType: "text/plain",
      declaredSize: 1,
      body: streamFromText("1"),
    });

    const first = await filesystem.listDirectory(null, 0, 2);
    const second = await filesystem.listDirectory(
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

  it("renames and moves metadata without changing the R2 object key", async () => {
    const { filesystem, files, repository, storage } = createServices();
    const folder = await filesystem.createDirectory(null, "문서함");
    const target = await filesystem.createDirectory(null, "보관함");
    const file = await files.uploadFile({
      parentId: folder.id,
      originalName: "기록.txt",
      contentType: "text/plain",
      declaredSize: 4,
      body: streamFromText("test"),
    });
    const objectKey = `${FILE_OBJECT_KEY_PREFIX}/${file.id}`;

    const moved = await filesystem.updateEntry(file.id, {
      parentId: target.id,
      name: "기록-완료.txt",
    });
    expect(moved).toMatchObject({ parentId: target.id, name: "기록-완료.txt" });
    expect(repository.records.get(file.id)?.objectKey).toBe(objectKey);
    expect(storage.objects.has(objectKey)).toBe(true);
  });

  it("moves a subtree to trash, restores with a numbered name, and purges its R2 files", async () => {
    const { filesystem, files, recycleBin, repository, storage, clock } = createServices();
    const folder = await filesystem.createDirectory(null, "보관함");
    const file = await files.uploadFile({
      parentId: folder.id,
      originalName: "기록.txt",
      contentType: "text/plain",
      declaredSize: 4,
      body: streamFromText("test"),
    });
    const objectKey = `${FILE_OBJECT_KEY_PREFIX}/${file.id}`;

    await filesystem.trashEntry(folder.id);
    expect(storage.objects.has(objectKey)).toBe(true);
    clock.timestamp += 1;
    await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "보관함");
    const restored = await recycleBin.restoreEntry(folder.id);
    expect(restored.name).toBe("보관함 (2)");

    await filesystem.trashEntry(folder.id);
    await recycleBin.permanentlyDeleteEntry(folder.id);
    expect(storage.objects.has(objectKey)).toBe(false);
    expect(repository.records.has(folder.id)).toBe(false);
    expect(repository.records.has(file.id)).toBe(false);
  });

  it("keeps trash metadata when R2 deletion fails", async () => {
    const { filesystem, files, recycleBin, repository, storage } = createServices();
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
    const { filesystem, recycleBin } = createServices();
    const parent = await filesystem.createDirectory(null, "부모");
    const child = await filesystem.createDirectory(parent.id, "자식");

    await filesystem.trashEntry(child.id);
    await filesystem.trashEntry(parent.id);
    const restored = await recycleBin.restoreEntry(child.id);

    expect(restored.parentId).toBe(FILESYSTEM_ROOT_ID.DOCUMENTS);
  });

  it("empties every trash root and its R2 objects", async () => {
    const { files, filesystem, recycleBin, repository, storage } =
      createServices();
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
});
