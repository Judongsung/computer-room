import { MOBILE_PREFERENCES_API_PATH } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import {
  HTTP_METHOD,
  PRIVATE_NO_STORE_RESPONSE_HEADERS,
} from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import { readJsonBody } from "@/http/shared/request-body";
import { jsonResponse } from "@/http/shared/responses";
import type { FeatureApiHandler } from "@/types/platform/http";
import type {
  MobilePreferences,
  MobilePreferencesUseCases,
} from "@/types/platform/mobile-preferences";

export class MobilePreferencesApiHandler implements FeatureApiHandler {
  constructor(private readonly preferences: MobilePreferencesUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname !== MOBILE_PREFERENCES_API_PATH) return null;

    if (request.method === HTTP_METHOD.GET) {
      return this.response(await this.preferences.getPreferences());
    }
    if (request.method === HTTP_METHOD.PATCH) {
      const body = await readJsonBody(request);
      if (!isRecord(body)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
      const wallpaperFileId = body.wallpaperFileId;
      if (wallpaperFileId !== null && typeof wallpaperFileId !== "string") {
        throw new AppError(HTTP_ERRORS.INVALID_JSON);
      }
      return this.response(
        await this.preferences.updateWallpaper(wallpaperFileId),
      );
    }
    throw new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
  }

  private response(preferences: MobilePreferences): Response {
    return jsonResponse(
      { preferences },
      undefined,
      PRIVATE_NO_STORE_RESPONSE_HEADERS,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
