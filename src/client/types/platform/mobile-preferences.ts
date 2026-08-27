import type { MobilePreferences } from "@/types/platform/mobile-preferences";

export interface MobilePreferencesGateway {
  getPreferences(): Promise<MobilePreferences>;
  updateWallpaper(entryId: string | null): Promise<MobilePreferences>;
}
