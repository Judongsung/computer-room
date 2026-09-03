import { IMAGE_UPLOAD_LOG_ERRORS } from "@/constants/integrations/errors/image-upload-log";
import { IMAGE_UPLOAD_LOG_SETTINGS_API_PATH } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import {
  HTTP_METHOD,
  PRIVATE_NO_STORE_RESPONSE_HEADERS,
} from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import { readJsonBody } from "@/http/shared/request-body";
import { jsonResponse } from "@/http/shared/responses";
import type {
  ImageUploadLogSettings,
  ImageUploadLogSettingsResponse,
  ImageUploadLogSettingsUseCases,
} from "@/types/integrations/image-upload-log";
import type { FeatureApiHandler } from "@/types/platform/http";

export class ImageUploadLogSettingsApiHandler implements FeatureApiHandler {
  constructor(private readonly settings: ImageUploadLogSettingsUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname !== IMAGE_UPLOAD_LOG_SETTINGS_API_PATH) return null;

    if (request.method === HTTP_METHOD.GET) {
      return this.response(await this.settings.getSettings());
    }
    if (request.method === HTTP_METHOD.PATCH) {
      const body = await readJsonBody(request);
      if (!isRecord(body) || typeof body.retentionDays !== "number") {
        throw new AppError(IMAGE_UPLOAD_LOG_ERRORS.INVALID_RETENTION_DAYS);
      }
      return this.response(
        await this.settings.updateRetentionDays(body.retentionDays),
      );
    }
    throw new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
  }

  private response(settings: ImageUploadLogSettings): Response {
    return jsonResponse(
      { settings } satisfies ImageUploadLogSettingsResponse,
      undefined,
      PRIVATE_NO_STORE_RESPONSE_HEADERS,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
