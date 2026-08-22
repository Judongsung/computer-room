import { describe, expect, it } from "vitest";
import { FileService } from "../src/application/file-service";
import { FilesystemPathService } from "../src/application/filesystem-path-service";
import { FilesystemService } from "../src/application/filesystem-service";
import { FILESYSTEM_ERRORS } from "../src/constants/errors/filesystem";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "../src/constants/filesystem";
import { WIDGET_TYPE } from "../src/constants/widget";
import { filesystemNameKey } from "../src/domain/filesystem-name";
import {
  MemoryFileRepository,
  MemoryObjectStorage,
  SequenceIdGenerator,
  StaticClock,
  streamFromText,
} from "./fakes";

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
    const filesystem = new FilesystemService(
      repository,
      new SequenceIdGenerator(["unused"]),
      clock,
    );
    const original = await paths.ensureDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "NovelAI",
    );

    await filesystem.moveEntry(original.id, {
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
    const filesystem = new FilesystemService(
      repository,
      new SequenceIdGenerator(["unused"]),
      clock,
    );
    const original = await paths.ensureDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      "NovelAI",
    );

    await filesystem.trashEntry(original.id);
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
