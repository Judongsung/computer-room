import { FILE_STATUS } from "@/constants/filesystem/file";
import {
  FILESYSTEM_ACTIVE_ROOT_IDS,
  FILESYSTEM_ENTRY_KIND,
} from "@/constants/filesystem/filesystem";
import { MEDIA_KIND } from "@/constants/filesystem/media";
import { MOBILE_PREFERENCES_ERRORS } from "@/constants/platform/errors/mobile-preferences";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import { AppError } from "@/domain/shared/errors";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type { FilesystemQueryRepository } from "@/types/filesystem/repository";
import type {
  MobilePreferences,
  MobilePreferencesRepository,
  MobilePreferencesUseCases,
} from "@/types/platform/mobile-preferences";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";

export class MobilePreferencesService implements MobilePreferencesUseCases {
  constructor(
    private readonly preferences: MobilePreferencesRepository,
    private readonly entries: FilesystemQueryRepository,
  ) {}

  async getPreferences(): Promise<MobilePreferences> {
    const entryId = await this.preferences.findWallpaperEntryId();
    return {
      wallpaper: entryId === null ? null : await this.findWallpaper(entryId),
    };
  }

  async updateWallpaper(entryId: string | null): Promise<MobilePreferences> {
    if (entryId === null) {
      await this.preferences.saveWallpaperEntryId(null);
      return { wallpaper: null };
    }

    const entry = await this.entries.findEntryWithinRoots(
      entryId,
      FILESYSTEM_ACTIVE_ROOT_IDS,
    );
    if (
      !entry ||
      entry.kind !== FILESYSTEM_ENTRY_KIND.FILE ||
      entry.fileStatus !== FILE_STATUS.READY ||
      entry.contentType === null
    ) {
      throw new AppError(MOBILE_PREFERENCES_ERRORS.WALLPAPER_FILE_NOT_FOUND);
    }
    if (mediaKindFromContentType(entry.contentType) !== MEDIA_KIND.IMAGE) {
      throw new AppError(
        MOBILE_PREFERENCES_ERRORS.WALLPAPER_FILE_TYPE_NOT_SUPPORTED,
      );
    }

    const wallpaper = toPublicEntry(entry);
    if (wallpaper.kind !== FILESYSTEM_ENTRY_KIND.FILE) {
      throw new AppError(MOBILE_PREFERENCES_ERRORS.WALLPAPER_FILE_NOT_FOUND);
    }
    await this.preferences.saveWallpaperEntryId(wallpaper.id);
    return { wallpaper };
  }

  private async findWallpaper(
    entryId: string,
  ): Promise<FilesystemFileEntry | null> {
    const entry = await this.entries.findEntryWithinRoots(
      entryId,
      FILESYSTEM_ACTIVE_ROOT_IDS,
    );
    if (
      !entry ||
      entry.kind !== FILESYSTEM_ENTRY_KIND.FILE ||
      entry.fileStatus !== FILE_STATUS.READY ||
      entry.contentType === null ||
      mediaKindFromContentType(entry.contentType) !== MEDIA_KIND.IMAGE
    ) {
      return null;
    }
    const wallpaper = toPublicEntry(entry);
    return wallpaper.kind === FILESYSTEM_ENTRY_KIND.FILE ? wallpaper : null;
  }
}
