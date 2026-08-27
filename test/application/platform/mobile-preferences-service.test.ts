import { describe, expect, it } from "vitest";
import { MobilePreferencesService } from "@/application/platform/mobile-preferences-service";
import { FILE_STATUS } from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { MOBILE_PREFERENCES_ERRORS } from "@/constants/platform/errors/mobile-preferences";
import type { NewFilesystemFile } from "@/types/filesystem/filesystem";
import type { MobilePreferencesRepository } from "@/types/platform/mobile-preferences";
import { MemoryFileRepository } from "@test/support/filesystem/memory-filesystem-repository";

const NOW = 1_700_000_000_000;

describe("MobilePreferencesService", () => {
  it("stores an active image and follows its active rename and move", async () => {
    const { entries, preferences, service } = createService();
    await insertReadyFile(entries, "wallpaper", "image/png");

    await expect(service.updateWallpaper("wallpaper")).resolves.toMatchObject({
      wallpaper: { id: "wallpaper", name: "wallpaper.png" },
    });
    expect(preferences.wallpaperEntryId).toBe("wallpaper");

    await entries.updateEntry(
      "wallpaper",
      FILESYSTEM_ROOT_ID.DESKTOP,
      "renamed.png",
      "renamed.png",
      NOW + 1,
      ["wallpaper"],
    );
    await expect(service.getPreferences()).resolves.toMatchObject({
      wallpaper: {
        id: "wallpaper",
        name: "renamed.png",
        parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      },
    });
  });

  it("rejects missing, inactive, and non-image entries", async () => {
    const { entries, service } = createService();
    await insertReadyFile(entries, "notes", "text/plain");
    await insertReadyFile(entries, "trashed-image", "image/png");
    await entries.moveToTrash(
      "trashed-image",
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "내 문서",
      NOW + 1,
    );

    await expect(service.updateWallpaper("missing")).rejects.toMatchObject({
      code: MOBILE_PREFERENCES_ERRORS.WALLPAPER_FILE_NOT_FOUND.code,
    });
    await expect(service.updateWallpaper("trashed-image")).rejects.toMatchObject({
      code: MOBILE_PREFERENCES_ERRORS.WALLPAPER_FILE_NOT_FOUND.code,
    });
    await expect(service.updateWallpaper("notes")).rejects.toMatchObject({
      code: MOBILE_PREFERENCES_ERRORS.WALLPAPER_FILE_TYPE_NOT_SUPPORTED.code,
    });
    await expect(
      service.updateWallpaper(FILESYSTEM_ROOT_ID.DOCUMENTS),
    ).rejects.toMatchObject({
      code: MOBILE_PREFERENCES_ERRORS.WALLPAPER_FILE_NOT_FOUND.code,
    });
  });

  it("returns the default when a stored reference is no longer active", async () => {
    const { entries, preferences, service } = createService();
    await insertReadyFile(entries, "wallpaper", "image/webp");
    preferences.wallpaperEntryId = "wallpaper";
    await entries.moveToTrash(
      "wallpaper",
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "내 문서",
      NOW + 1,
    );

    await expect(service.getPreferences()).resolves.toEqual({ wallpaper: null });
    await expect(service.updateWallpaper(null)).resolves.toEqual({ wallpaper: null });
    expect(preferences.wallpaperEntryId).toBeNull();
  });
});

class MemoryMobilePreferencesRepository
  implements MobilePreferencesRepository
{
  wallpaperEntryId: string | null = null;

  async findWallpaperEntryId(): Promise<string | null> {
    return this.wallpaperEntryId;
  }

  async saveWallpaperEntryId(entryId: string | null): Promise<void> {
    this.wallpaperEntryId = entryId;
  }
}

function createService() {
  const entries = new MemoryFileRepository();
  const preferences = new MemoryMobilePreferencesRepository();
  return {
    entries,
    preferences,
    service: new MobilePreferencesService(preferences, entries),
  };
}

async function insertReadyFile(
  entries: MemoryFileRepository,
  id: string,
  contentType: string,
): Promise<void> {
  const file = {
    entry: {
      id,
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: id === "notes" ? "notes.txt" : "wallpaper.png",
      nameKey: id === "notes" ? "notes.txt" : "wallpaper.png",
      createdAt: NOW,
    },
    objectKey: `files/${id}`,
    contentType,
    size: 10,
  } satisfies NewFilesystemFile;
  await entries.insertPendingFile(file);
  await entries.markFileReady(id, file.size, `etag-${id}`);
  expect(entries.records.get(id)?.kind).toBe(FILESYSTEM_ENTRY_KIND.FILE);
  expect(entries.records.get(id)?.fileStatus).toBe(FILE_STATUS.READY);
}
