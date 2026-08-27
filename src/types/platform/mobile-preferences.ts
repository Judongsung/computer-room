import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";

export interface MobilePreferences {
  readonly wallpaper: FilesystemFileEntry | null;
}

export interface UpdateMobilePreferencesInput {
  readonly wallpaperFileId: string | null;
}

export interface MobilePreferencesRepository {
  findWallpaperEntryId(): Promise<string | null>;
  saveWallpaperEntryId(entryId: string | null): Promise<void>;
}

export interface MobilePreferencesUseCases {
  getPreferences(): Promise<MobilePreferences>;
  updateWallpaper(entryId: string | null): Promise<MobilePreferences>;
}
