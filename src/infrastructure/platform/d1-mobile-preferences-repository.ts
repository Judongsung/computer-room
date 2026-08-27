import { MOBILE_PREFERENCES_SINGLETON_ID } from "@/constants/platform/mobile-preferences";
import type { MobilePreferencesRepository } from "@/types/platform/mobile-preferences";

interface MobilePreferencesRow {
  readonly wallpaper_entry_id: string | null;
}

export class D1MobilePreferencesRepository
  implements MobilePreferencesRepository
{
  constructor(private readonly database: D1Database) {}

  async findWallpaperEntryId(): Promise<string | null> {
    const row = await this.database
      .prepare(
        `SELECT wallpaper_entry_id
         FROM mobile_preferences
         WHERE singleton_id = ?1`,
      )
      .bind(MOBILE_PREFERENCES_SINGLETON_ID)
      .first<MobilePreferencesRow>();
    return row?.wallpaper_entry_id ?? null;
  }

  async saveWallpaperEntryId(entryId: string | null): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO mobile_preferences(singleton_id, wallpaper_entry_id)
         VALUES (?1, ?2)
         ON CONFLICT(singleton_id) DO UPDATE SET
           wallpaper_entry_id = excluded.wallpaper_entry_id`,
      )
      .bind(MOBILE_PREFERENCES_SINGLETON_ID, entryId)
      .run();
  }
}
