import { describe, expect, it } from "vitest";
import { FileService } from "@/application/filesystem/file-service";
import { FilesystemEntryService } from "@/application/filesystem/entries/filesystem-entry-service";
import { FilesystemPathService } from "@/application/filesystem/filesystem-path-service";
import { RecycleBinService } from "@/application/filesystem/recycle/recycle-bin-service";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import { MemoryFileRepository } from "@test/support/filesystem/memory-filesystem-repository";
import { MemoryObjectStorage } from "@test/support/filesystem/memory-object-storage";
import { NOOP_FILE_UPLOAD_COMPENSATION_OBSERVER } from "@test/support/filesystem/file-upload-compensation-observer";
import {
  SequenceIdGenerator,
  StaticClock,
  streamFromText,
} from "@test/support/platform/runtime-fakes";

const NOW = Date.parse("2026-08-22T01:00:00.000Z");

describe("FilesystemPathService", () => {
  it("creates one exact desktop directory for concurrent requests", async () => {
    const repository = new MemoryFileRepository();
    const paths = new FilesystemPathService(
      repository,
      new SequenceIdGenerator(["novelai-a", "novelai-b"]),
      new StaticClock(NOW),
    );

    const [first, second] = await Promise.all([
      paths.ensureDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "NovelAI"),
      paths.ensureDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "NovelAI"),
    ]);

    expect(first.id).toBe(second.id);
    expect(first).toMatchObject({
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name: "NovelAI",
      desktopOrder: 0,
    });
    expect(
      [...repository.records.values()].filter(
        (entry) =>
          entry.parentId === FILESYSTEM_ROOT_ID.DESKTOP &&
          entry.name === "NovelAI",
      ),
    ).toHaveLength(1);
  });

  it("recreates the configured path after its original directory is moved", async () => {
    const repository = new MemoryFileRepository();
    const clock = new StaticClock(NOW);
    const paths = new FilesystemPathService(
      repository,
      new SequenceIdGenerator(["original", "replacement"]),
      clock,
    );
    const entries = new FilesystemEntryService(repository, clock);
    const original = await paths.ensureDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "NovelAI",
    );

    await entries.moveEntry(original.id, {
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
    });
    const replacement = await paths.ensureDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "NovelAI",
    );

    expect(replacement.id).toBe("replacement");
    expect(repository.records.get(original.id)?.parentId).toBe(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
    );
    expect(replacement.parentId).toBe(FILESYSTEM_ROOT_ID.DESKTOP);
  });

  it("recreates the configured path after its original directory is trashed", async () => {
    const repository = new MemoryFileRepository();
    const clock = new StaticClock(NOW);
    const paths = new FilesystemPathService(
      repository,
      new SequenceIdGenerator(["original", "replacement"]),
      clock,
    );
    const recycleBin = new RecycleBinService(
      repository,
      new MemoryObjectStorage(),
      clock,
    );
    const original = await paths.ensureDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "NovelAI",
    );

    await recycleBin.trashEntry(original.id);
    const replacement = await paths.ensureDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "NovelAI",
    );

    expect(replacement.id).toBe("replacement");
    expect(repository.records.get(original.id)).toMatchObject({
      parentId: FILESYSTEM_ROOT_ID.RECYCLE_BIN,
      trashedAt: NOW,
    });
    expect(replacement.parentId).toBe(FILESYSTEM_ROOT_ID.DESKTOP);
  });

  it("rejects an exact path occupied by a file", async () => {
    const repository = new MemoryFileRepository();
    const clock = new StaticClock(NOW);
    const files = new FileService(
      repository,
      new MemoryObjectStorage(),
      new SequenceIdGenerator(["file-id"]),
      clock,
      NOOP_FILE_UPLOAD_COMPENSATION_OBSERVER,
    );
    await files.uploadFile({
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      originalName: "NovelAI",
      contentType: "text/plain",
      declaredSize: 1,
      body: streamFromText("x"),
    });
    const paths = new FilesystemPathService(
      repository,
      new SequenceIdGenerator(["directory-id"]),
      clock,
    );

    await expect(
      paths.ensureDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "NovelAI"),
    ).rejects.toMatchObject({
      status: FILESYSTEM_ERRORS.DIRECTORY_PATH_CONFLICT.status,
      code: FILESYSTEM_ERRORS.DIRECTORY_PATH_CONFLICT.code,
    });
  });

  it("rejects an exact path occupied by a widget file", async () => {
    const repository = new MemoryFileRepository();
    await repository.insertWidget({
      id: "widget-entry",
      widgetId: "widget-id",
      widgetType: WIDGET_TYPE.MEMO,
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      name: "NovelAI",
      nameKey: filesystemNameKey("NovelAI"),
      createdAt: NOW,
      desktopOrder: 0,
    });
    const paths = new FilesystemPathService(
      repository,
      new SequenceIdGenerator(["directory-id"]),
      new StaticClock(NOW),
    );

    await expect(
      paths.ensureDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "NovelAI"),
    ).rejects.toMatchObject({
      status: FILESYSTEM_ERRORS.DIRECTORY_PATH_CONFLICT.status,
      code: FILESYSTEM_ERRORS.DIRECTORY_PATH_CONFLICT.code,
    });
  });
});
