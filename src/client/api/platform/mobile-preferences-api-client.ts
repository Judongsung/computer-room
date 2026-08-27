import { MOBILE_PREFERENCES_API_PATH } from "@/constants/platform/api";
import { HTTP_METHOD } from "@/constants/platform/http";
import type { MobilePreferences } from "@/types/platform/mobile-preferences";
import {
  isFileEntry,
} from "@client/api/filesystem/filesystem-api-contract";
import { isRecord } from "@client/api/shared/api-contract";
import { jsonRequest, requestJson } from "@client/api/shared/api-request";
import { CLIENT_ERRORS } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type { MobilePreferencesGateway } from "@client/types/platform/mobile-preferences";

export class MobilePreferencesApiClient implements MobilePreferencesGateway {
  async getPreferences(): Promise<MobilePreferences> {
    return this.request();
  }

  async updateWallpaper(entryId: string | null): Promise<MobilePreferences> {
    return this.request({
      ...jsonRequest(HTTP_METHOD.PATCH, { wallpaperFileId: entryId }),
    });
  }

  private async request(options: RequestInit = {}): Promise<MobilePreferences> {
    const payload = await requestJson(MOBILE_PREFERENCES_API_PATH, options);
    if (!isPreferencesEnvelope(payload)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return payload.preferences;
  }
}

function isPreferencesEnvelope(
  value: unknown,
): value is { readonly preferences: MobilePreferences } {
  return (
    isRecord(value) &&
    isRecord(value.preferences) &&
    (value.preferences.wallpaper === null ||
      isFileEntry(value.preferences.wallpaper))
  );
}
