import { describe, expect, it } from "vitest";
import { FileService } from "@/application/filesystem/file-service";
import { FilesystemDownloadManifestService } from "@/application/filesystem/filesystem-download-manifest-service";
import { FilesystemService } from "@/application/filesystem/filesystem-service";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import {
  MemoryDirectorySortRepository,
  MemoryFileRepository,
  MemoryObjectStorage,
  SequenceIdGenerator,
  StaticClock,
  streamFromText,
} from "@test/fakes";

describe("FilesystemDownloadManifestService", () => {
  it("preserves nested and empty folders, Korean names, and excludes widgets", async () => {
    const repository = new MemoryFileRepository();
    const storage = new MemoryObjectStorage();
    const ids = new SequenceIdGenerator([
      "folder",
      "nested",
      "empty",
      "file-a",
      "file-b",
    ]);
    const clock = new StaticClock(Date.parse("2026-08-23T01:00:00.000Z"));
    const filesystem = new FilesystemService(
      repository,
      new MemoryDirectorySortRepository(),
      ids,
      clock,
    );
    const files = new FileService(repository, storage, ids, clock);
    const manifests = new FilesystemDownloadManifestService(repository);

    const folder = await filesystem.createDirectory(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "자료",
    );
    const nested = await filesystem.createDirectory(folder.id, "하위");
    await filesystem.createDirectory(folder.id, "빈 폴더");
    const text = await files.uploadFile({
      parentId: folder.id,
      originalName: "한글.txt",
      contentType: "text/plain",
      declaredSize: 4,
      body: streamFromText("text"),
    });
    const image = await files.uploadFile({
      parentId: nested.id,
      originalName: "사진.png",
      contentType: "image/png",
      declaredSize: 3,
      body: streamFromText("png"),
    });
    await repository.insertWidget({
      id: "widget-entry",
      widgetId: "widget",
      widgetType: WIDGET_TYPE.MEMO,
      parentId: folder.id,
      name: "메모",
      nameKey: "메모",
      createdAt: clock.now(),
    });

    const manifest = await manifests.createManifest([folder.id, folder.id]);

    expect(manifest.archiveName).toBe("자료.zip");
    expect(manifest.totalFileCount).toBe(2);
    expect(manifest.totalBytes).toBe(7);
    expect(manifest.skippedWidgetIds).toEqual(["widget-entry"]);
    expect(manifest.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
          path: "자료/",
        }),
        expect.objectContaining({
          kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
          path: "자료/빈 폴더/",
        }),
        expect.objectContaining({
          kind: FILESYSTEM_ENTRY_KIND.FILE,
          id: text.id,
          path: "자료/한글.txt",
        }),
        expect.objectContaining({
          kind: FILESYSTEM_ENTRY_KIND.FILE,
          id: image.id,
          path: "자료/하위/사진.png",
        }),
      ]),
    );
  });

  it("rejects a root after it moves to the recycle bin", async () => {
    const repository = new MemoryFileRepository();
    const ids = new SequenceIdGenerator(["folder"]);
    const clock = new StaticClock(Date.parse("2026-08-23T01:00:00.000Z"));
    const filesystem = new FilesystemService(
      repository,
      new MemoryDirectorySortRepository(),
      ids,
      clock,
    );
    const manifests = new FilesystemDownloadManifestService(repository);
    const folder = await filesystem.createDirectory(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "삭제 예정",
    );
    await filesystem.trashEntry(folder.id);

    await expect(manifests.createManifest([folder.id])).rejects.toMatchObject({
      code: FILESYSTEM_ERRORS.ENTRY_NOT_ACTIVE.code,
    });
  });
});
