import { MOBILE_PREFERENCES_API_PATH } from "@/constants/platform/api";
import {
  HTTP_HEADERS,
  HTTP_MEDIA_TYPE,
  HTTP_METHOD,
} from "@/constants/platform/http";
import type { MobilePreferences } from "@/types/platform/mobile-preferences";
import {
  isFileEntry,
  isRecord,
} from "@client/api/filesystem/filesystem-api-contract";
import { ApiError } from "@client/api/widgets/dashboard-api-client";
import { API_REQUEST_OPTIONS } from "@client/constants/shared/api";
import { CLIENT_ERRORS } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type { MobilePreferencesGateway } from "@client/types/platform/mobile-preferences";

export class MobilePreferencesApiClient implements MobilePreferencesGateway {
  async getPreferences(): Promise<MobilePreferences> {
    return this.request();
  }

  async updateWallpaper(entryId: string | null): Promise<MobilePreferences> {
    return this.request({
      method: HTTP_METHOD.PATCH,
      headers: { [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON },
      body: JSON.stringify({ wallpaperFileId: entryId }),
    });
  }

  private async request(options: RequestInit = {}): Promise<MobilePreferences> {
    const response = await fetch(MOBILE_PREFERENCES_API_PATH, {
      credentials: API_REQUEST_OPTIONS.CREDENTIALS,
      ...options,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = readApiError(payload);
      throw new ApiError(error.code, error.message, response.status);
    }
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

function readApiError(value: unknown): { code: string; message: string } {
  if (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  ) {
    return { code: value.error.code, message: value.error.message };
  }
  return CLIENT_ERRORS.REQUEST_FAILED;
}
