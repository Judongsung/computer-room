import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE, WIDGET_WINDOW_POLICY } from "@/constants/widgets/widget";
import { D1FilesystemRepository } from "@/infrastructure/filesystem/d1-filesystem-repository";

interface FilesystemRepositoryTestEnvironment {
  readonly FILESYSTEM_REPOSITORY_TEST_DB: D1Database;
  readonly TEST_MIGRATIONS: readonly D1Migration[];
}

const testEnvironment = env as typeof env & FilesystemRepositoryTestEnvironment;
const database = testEnvironment.FILESYSTEM_REPOSITORY_TEST_DB;
const repository = new D1FilesystemRepository(database);

beforeAll(async () => {
  await applyD1Migrations(database, [...testEnvironment.TEST_MIGRATIONS]);
});

beforeEach(async () => {
  await database.prepare("DELETE FROM guest_publications").run();
  await database
    .prepare(
      "UPDATE mobile_preferences SET wallpaper_entry_id = NULL WHERE singleton_id = 1",
    )
    .run();
  await database.prepare("DELETE FROM desktop_entry_order").run();
  await database.prepare("DELETE FROM files").run();
  await database
    .prepare("DELETE FROM filesystem_entries WHERE id NOT IN (?1, ?2, ?3)")
    .bind(
      FILESYSTEM_ROOT_ID.DESKTOP,
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      FILESYSTEM_ROOT_ID.RECYCLE_BIN,
    )
    .run();
  await database.prepare("DELETE FROM dashboard_widgets").run();
});

describe("D1FilesystemRepository queries", () => {
  it("maps active entries and traverses roots, children, and breadcrumbs", async () => {
    await insertDirectory("photos", FILESYSTEM_ROOT_ID.DOCUMENTS, "Photos", 10);
    await insertDirectory("archive", "photos", "Archive", 20);
    await insertReadyFile("image", "photos", "image.png", 30);

    const children = await repository.listChildren(
      "photos",
      0,
      10,
      DEFAULT_FILESYSTEM_DIRECTORY_SORT,
    );
    expect(children.map(({ id }) => id)).toEqual(["archive", "image"]);
    expect(children[1]).toMatchObject({
      kind: FILESYSTEM_ENTRY_KIND.FILE,
      objectKey: "files/image",
      contentType: "image/png",
      size: 4,
      etag: "etag-image",
    });

    await expect(repository.listBreadcrumbs("archive")).resolves.toEqual([
      expect.objectContaining({ id: FILESYSTEM_ROOT_ID.DOCUMENTS }),
      { id: "photos", name: "Photos" },
      { id: "archive", name: "Archive" },
    ]);
    await expect(
      repository.findEntryWithinRoots("image", [FILESYSTEM_ROOT_ID.DOCUMENTS]),
    ).resolves.toMatchObject({ id: "image" });
    await expect(
      repository.findEntryWithinRoots("image", [FILESYSTEM_ROOT_ID.DESKTOP]),
    ).resolves.toBeNull();
    await expect(
      repository.findEntriesWithinRoots(
        ["image", "archive", "missing", "image"],
        [FILESYSTEM_ROOT_ID.DOCUMENTS],
      ),
    ).resolves.toEqual([
      expect.objectContaining({ id: "archive" }),
      expect.objectContaining({ id: "image" }),
    ]);
    await expect(
      repository.isWithinRoot("archive", FILESYSTEM_ROOT_ID.DOCUMENTS),
    ).resolves.toBe(true);
    await expect(repository.isDescendant("photos", "archive")).resolves.toBe(
      true,
    );

    const subtree = await repository.listActiveSubtrees(["photos"]);
    expect(subtree.map(({ rootId, entry }) => [rootId, entry.id])).toEqual([
      ["photos", "archive"],
      ["photos", "image"],
      ["photos", "photos"],
    ]);
  });
});

describe("D1FilesystemRepository mutations and desktop order", () => {
  it("returns one exact directory for concurrent insert-or-read requests", async () => {
    const [first, second] = await Promise.all([
      repository.ensureDirectory({
        id: "generated-one",
        parentId: FILESYSTEM_ROOT_ID.DESKTOP,
        name: "Generated",
        nameKey: "generated",
        createdAt: 10,
      }),
      repository.ensureDirectory({
        id: "generated-two",
        parentId: FILESYSTEM_ROOT_ID.DESKTOP,
        name: "Generated",
        nameKey: "generated",
        createdAt: 20,
      }),
    ]);

    expect(first.id).toBe(second.id);
    expect(["generated-one", "generated-two"]).toContain(first.id);
    await expect(repository.listDesktopEntryIds()).resolves.toEqual([first.id]);
  });

  it("rolls back file creation when desktop order insertion fails", async () => {
    await insertDirectory(
      "occupied",
      FILESYSTEM_ROOT_ID.DESKTOP,
      "Occupied",
      10,
      0,
    );

    await expect(
      repository.insertPendingFile({
        entry: {
          id: "rolled-back-file",
          parentId: FILESYSTEM_ROOT_ID.DESKTOP,
          name: "rolled-back.png",
          nameKey: "rolled-back.png",
          createdAt: 20,
          desktopOrder: 0,
        },
        objectKey: "files/rolled-back-file",
        contentType: "image/png",
        size: 4,
      }),
    ).rejects.toThrow();

    await expect(repository.findEntry("rolled-back-file")).resolves.toBeNull();
    await expect(
      database
        .prepare("SELECT id FROM files WHERE id = ?1")
        .bind("rolled-back-file")
        .first(),
    ).resolves.toBeNull();
    await expect(repository.listDesktopEntryIds()).resolves.toEqual(["occupied"]);
  });

  it("rolls back entry updates when desktop order replacement fails", async () => {
    await insertDirectory(
      "first",
      FILESYSTEM_ROOT_ID.DESKTOP,
      "First",
      10,
      0,
    );
    await insertDirectory(
      "second",
      FILESYSTEM_ROOT_ID.DESKTOP,
      "Second",
      20,
      1,
    );

    await expect(
      repository.updateEntry(
        "first",
        FILESYSTEM_ROOT_ID.DOCUMENTS,
        "Changed",
        "changed",
        30,
        ["second", "second"],
      ),
    ).rejects.toThrow();

    await expect(repository.findEntry("first")).resolves.toMatchObject({
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      name: "First",
    });
    await expect(repository.listDesktopEntryIds()).resolves.toEqual([
      "first",
      "second",
    ]);
  });
});

describe("D1FilesystemRepository recycle bin", () => {
  it("moves a subtree atomically, closes widgets, clears wallpaper, and restores it", async () => {
    await insertDirectory(
      "trash-folder",
      FILESYSTEM_ROOT_ID.DESKTOP,
      "Trash folder",
      10,
      0,
    );
    await insertReadyFile("wallpaper", "trash-folder", "wallpaper.png", 20);
    await insertWidget("memo-widget", "memo-entry", "trash-folder", 30);
    await database
      .prepare(
        "UPDATE mobile_preferences SET wallpaper_entry_id = ?1 WHERE singleton_id = 1",
      )
      .bind("wallpaper")
      .run();
    await database.batch([
      database
        .prepare(
          "INSERT INTO guest_publications(entry_id, published_at) VALUES (?1, 30)",
        )
        .bind("trash-folder"),
      database
        .prepare(
          "INSERT INTO guest_publications(entry_id, published_at) VALUES (?1, 30)",
        )
        .bind("wallpaper"),
    ]);

    await expect(
      repository.moveToTrash(
        "trash-folder",
        FILESYSTEM_ROOT_ID.DESKTOP,
        "바탕 화면/Trash folder",
        40,
        ["trash-folder", "trash-folder"],
      ),
    ).rejects.toThrow();
    await expect(repository.findEntry("trash-folder")).resolves.toMatchObject({
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      trashedAt: null,
    });
    await expect(widgetOpen("memo-widget")).resolves.toBe(1);
    await expect(currentWallpaper()).resolves.toBe("wallpaper");
    await expect(publishedEntryIds()).resolves.toEqual([
      "trash-folder",
      "wallpaper",
    ]);

    await expect(
      repository.moveToTrash(
        "trash-folder",
        FILESYSTEM_ROOT_ID.DESKTOP,
        "바탕 화면/Trash folder",
        40,
        [],
      ),
    ).resolves.toEqual(["memo-widget"]);
    await expect(repository.findEntry("trash-folder")).resolves.toMatchObject({
      parentId: FILESYSTEM_ROOT_ID.RECYCLE_BIN,
      restoreParentId: FILESYSTEM_ROOT_ID.DESKTOP,
      restorePath: "바탕 화면/Trash folder",
      trashedAt: 40,
    });
    await expect(widgetOpen("memo-widget")).resolves.toBe(0);
    await expect(currentWallpaper()).resolves.toBeNull();
    await expect(publishedEntryIds()).resolves.toEqual([]);
    await expect(repository.listDesktopEntryIds()).resolves.toEqual([]);
    await expect(repository.listTrashRootIds()).resolves.toEqual(["trash-folder"]);

    await insertDirectory(
      "occupied",
      FILESYSTEM_ROOT_ID.DESKTOP,
      "Occupied",
      50,
      0,
    );
    await expect(
      repository.restoreEntry(
        "trash-folder",
        FILESYSTEM_ROOT_ID.DESKTOP,
        "Trash folder",
        "trash folder",
        60,
        0,
      ),
    ).rejects.toThrow();
    await expect(repository.findEntry("trash-folder")).resolves.toMatchObject({
      parentId: FILESYSTEM_ROOT_ID.RECYCLE_BIN,
      trashedAt: 40,
    });

    await repository.restoreEntry(
      "trash-folder",
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "Trash folder",
      "trash folder",
      70,
    );
    await expect(repository.findEntry("trash-folder")).resolves.toMatchObject({
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      restoreParentId: null,
      restorePath: null,
      trashedAt: null,
    });
  });

  it("lists file objects and purges file, widget, and entry subtrees", async () => {
    await insertDirectory("purge-folder", FILESYSTEM_ROOT_ID.DOCUMENTS, "Purge", 10);
    await insertReadyFile("purge-file", "purge-folder", "purge.png", 20);
    await insertWidget("purge-widget", "purge-widget-entry", "purge-folder", 30);
    await repository.moveToTrash(
      "purge-folder",
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "내 문서/Purge",
      40,
    );

    await expect(repository.listSubtreeFileObjects("purge-folder")).resolves.toEqual([
      { id: "purge-file", objectKey: "files/purge-file" },
    ]);
    await repository.purgeEntry("purge-folder");

    await expect(repository.findEntry("purge-folder")).resolves.toBeNull();
    await expect(repository.findEntry("purge-file")).resolves.toBeNull();
    await expect(
      database
        .prepare("SELECT id FROM files WHERE id = ?1")
        .bind("purge-file")
        .first(),
    ).resolves.toBeNull();
    await expect(
      database
        .prepare("SELECT id FROM dashboard_widgets WHERE id = ?1")
        .bind("purge-widget")
        .first(),
    ).resolves.toBeNull();
  });
});

async function insertDirectory(
  id: string,
  parentId: string,
  name: string,
  createdAt: number,
  desktopOrder?: number,
): Promise<void> {
  await repository.insertDirectory({
    id,
    parentId,
    name,
    nameKey: name.toLocaleLowerCase("en-US"),
    createdAt,
    ...(desktopOrder === undefined ? {} : { desktopOrder }),
  });
}

async function insertReadyFile(
  id: string,
  parentId: string,
  name: string,
  createdAt: number,
): Promise<void> {
  await repository.insertPendingFile({
    entry: {
      id,
      parentId,
      name,
      nameKey: name.toLocaleLowerCase("en-US"),
      createdAt,
    },
    objectKey: `files/${id}`,
    contentType: "image/png",
    size: 4,
  });
  await repository.markFileReady(id, 4, `etag-${id}`);
}

async function insertWidget(
  widgetId: string,
  entryId: string,
  parentId: string,
  createdAt: number,
): Promise<void> {
  const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];
  await database
    .prepare(
      `INSERT INTO dashboard_widgets (
         id, type, position_x, position_y, width, height,
         window_state, restore_state, stack_order, is_open
       ) VALUES (?1, ?2, 0, 0, ?3, ?4, 'normal', 'normal', 0, 1)`,
    )
    .bind(widgetId, WIDGET_TYPE.MEMO, policy.DEFAULT_WIDTH, policy.DEFAULT_HEIGHT)
    .run();
  await repository.insertWidget({
    id: entryId,
    widgetId,
    widgetType: WIDGET_TYPE.MEMO,
    parentId,
    name: "Memo",
    nameKey: "memo",
    createdAt,
  });
}

async function widgetOpen(widgetId: string): Promise<number | null> {
  return database
    .prepare("SELECT is_open FROM dashboard_widgets WHERE id = ?1")
    .bind(widgetId)
    .first<number>("is_open");
}

async function currentWallpaper(): Promise<string | null> {
  return database
    .prepare("SELECT wallpaper_entry_id FROM mobile_preferences WHERE singleton_id = 1")
    .first<string>("wallpaper_entry_id");
}

async function publishedEntryIds(): Promise<string[]> {
  const result = await database
    .prepare("SELECT entry_id FROM guest_publications ORDER BY entry_id")
    .all<{ entry_id: string }>();
  return result.results.map((row) => row.entry_id);
}
