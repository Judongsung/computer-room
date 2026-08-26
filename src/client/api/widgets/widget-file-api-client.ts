import { API_PATHS } from "@/constants/platform/api";
import { HTTP_HEADERS, HTTP_MEDIA_TYPE, HTTP_METHOD } from "@/constants/platform/http";
import { isDashboardWidget } from "@/domain/widgets/widget-contract";
import type {
  CreateWidgetFileInput,
  WidgetFileDocument,
} from "@/types/widgets/widget-file";
import { isWidgetEntry } from "@client/api/filesystem/filesystem-api-contract";
import { ApiError } from "@client/api/widgets/dashboard-api-client";
import { API_REQUEST_OPTIONS } from "@client/constants/shared/api";
import { CLIENT_ERRORS } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";

export class WidgetFileApiClient implements WidgetFileGateway {
  async getWidgetFile(entryId: string): Promise<WidgetFileDocument> {
    return this.request(
      `${API_PATHS.WIDGET_FILES}/${encodeURIComponent(entryId)}`,
    );
  }

  async createWidgetFile(
    input: CreateWidgetFileInput,
  ): Promise<WidgetFileDocument> {
    return this.request(API_PATHS.WIDGET_FILES, {
      method: HTTP_METHOD.POST,
      headers: { [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON },
      body: JSON.stringify(input),
    });
  }

  private async request(
    path: string,
    options: RequestInit = {},
  ): Promise<WidgetFileDocument> {
    const response = await fetch(path, {
      credentials: API_REQUEST_OPTIONS.CREDENTIALS,
      ...options,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = readApiError(payload);
      throw new ApiError(error.code, error.message, response.status);
    }
    if (
      !isRecord(payload) ||
      !isDashboardWidget(payload.widget) ||
      !isWidgetEntry(payload.entry)
    ) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return { widget: payload.widget, entry: payload.entry };
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
