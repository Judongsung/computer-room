import { isChecklistRetentionDays } from "@/domain/widgets/checklist-retention";
import { CHECKLIST_RETENTION_ERRORS } from "@/constants/widgets/errors/checklist-retention";
import { CHECKLIST_SETTINGS_API_PATH } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import {
  HTTP_METHOD,
  PRIVATE_NO_STORE_RESPONSE_HEADERS,
} from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import { readJsonBody } from "@/http/shared/request-body";
import { jsonResponse } from "@/http/shared/responses";
import type {
  ChecklistRetentionSettings,
  ChecklistRetentionUseCases,
} from "@/types/widgets/checklist/retention";
import type { FeatureApiHandler } from "@/types/platform/http";

export class ChecklistRetentionApiHandler implements FeatureApiHandler {
  constructor(private readonly settings: ChecklistRetentionUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname !== CHECKLIST_SETTINGS_API_PATH) return null;

    if (request.method === HTTP_METHOD.GET) {
      return this.response(await this.settings.getSettings());
    }
    if (request.method === HTTP_METHOD.PATCH) {
      const body = await readJsonBody(request);
      if (!isRecord(body) || !isChecklistRetentionDays(body.retentionDays)) {
        throw new AppError(CHECKLIST_RETENTION_ERRORS.INVALID_DAYS);
      }
      return this.response(
        await this.settings.updateRetentionDays(body.retentionDays),
      );
    }
    throw new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
  }

  private response(settings: ChecklistRetentionSettings): Response {
    return jsonResponse(
      { settings },
      undefined,
      PRIVATE_NO_STORE_RESPONSE_HEADERS,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
