import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GUEST_PUBLICATION_STATE } from "@/constants/admin/guest-access";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { D1GuestAccessRepository } from "@/infrastructure/admin/d1-guest-access-repository";
import { D1FilesystemRepository } from "@/infrastructure/filesystem/d1-filesystem-repository";

interface GuestAccessTestEnvironment {
  readonly GUEST_ACCESS_TEST_DB: D1Database;
  readonly TEST_MIGRATIONS: readonly D1Migration[];
}

const testEnvironment = env as typeof env & GuestAccessTestEnvironment;
const database = testEnvironment.GUEST_ACCESS_TEST_DB;
const guestAccess = new D1GuestAccessRepository(database);
const filesystem = new D1FilesystemRepository(database);

beforeAll(async () => {
  await applyD1Migrations(database, [...testEnvironment.TEST_MIGRATIONS]);
});

beforeEach(async () => {
  await database.prepare("DELETE FROM guest_publications").run();
  await database
    .prepare(
      "UPDATE guest_access_settings SET enabled = 0 WHERE singleton_id = 1",
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

describe("D1GuestAccessRepository", () => {
  it("stores one disabled-by-default master setting without changing publications", async () => {
    await expect(guestAccess.getSettings()).resolves.toEqual({ enabled: false });
    await insertDirectory("published-folder", FILESYSTEM_ROOT_ID.DOCUMENTS);
    await guestAccess.setEntryPublished("published-folder", false, true, 10);

    await expect(guestAccess.saveSettings(true)).resolves.toEqual({ enabled: true });
    await expect(guestAccess.saveSettings(false)).resolves.toEqual({ enabled: false });
    await expect(publicationIds()).resolves.toEqual(["published-folder"]);
  });

  it("calculates private, partial, and public subtree states", async () => {
    await insertDirectory("folder", FILESYSTEM_ROOT_ID.DOCUMENTS);
    await insertDirectory("child", "folder");

    await expect(guestAccess.findPublicationStates(["folder", "child"]))
      .resolves.toEqual(
        new Map([
          ["folder", GUEST_PUBLICATION_STATE.PRIVATE],
          ["child", GUEST_PUBLICATION_STATE.PRIVATE],
        ]),
      );
    await expect(
      guestAccess.setEntryPublished("child", false, true, 20),
    ).resolves.toBe(1);
    await expect(guestAccess.findPublicationStates(["folder", "child"]))
      .resolves.toEqual(
        new Map([
          ["folder", GUEST_PUBLICATION_STATE.PARTIAL],
          ["child", GUEST_PUBLICATION_STATE.PUBLIC],
        ]),
      );
    await expect(
      guestAccess.setEntryPublished("folder", true, true, 30),
    ).resolves.toBe(1);
    await expect(guestAccess.findPublicationStates(["folder"]))
      .resolves.toEqual(
        new Map([["folder", GUEST_PUBLICATION_STATE.PUBLIC]]),
      );
  });

  it("keeps entries created after a folder publication private", async () => {
    await insertDirectory("folder", FILESYSTEM_ROOT_ID.DOCUMENTS);
    await guestAccess.setEntryPublished("folder", true, true, 40);
    await insertDirectory("later-child", "folder");

    await expect(guestAccess.findPublicationStates(["folder", "later-child"]))
      .resolves.toEqual(
        new Map([
          ["folder", GUEST_PUBLICATION_STATE.PARTIAL],
          ["later-child", GUEST_PUBLICATION_STATE.PRIVATE],
        ]),
      );
    await expect(
      guestAccess.setEntryPublished("folder", true, false, 50),
    ).resolves.toBe(1);
    await expect(publicationIds()).resolves.toEqual([]);
  });
});

async function insertDirectory(id: string, parentId: string): Promise<void> {
  await filesystem.insertDirectory({
    id,
    parentId,
    name: id,
    nameKey: id,
    createdAt: 1,
  });
}

async function publicationIds(): Promise<string[]> {
  const result = await database
    .prepare("SELECT entry_id FROM guest_publications ORDER BY entry_id")
    .all<{ entry_id: string }>();
  return result.results.map((row) => row.entry_id);
}
