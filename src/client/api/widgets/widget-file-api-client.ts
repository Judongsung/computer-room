import { API_PATHS } from "@/constants/platform/api";
import { HTTP_METHOD } from "@/constants/platform/http";
import { isDashboardWidget } from "@/domain/widgets/widget-contract";
import type {
  CreateWidgetFileInput,
  WidgetFileDocument,
} from "@/types/widgets/widget-file";
import { isWidgetEntry } from "@client/api/filesystem/filesystem-api-contract";
import { isRecord } from "@client/api/shared/api-contract";
import { jsonRequest, requestJson } from "@client/api/shared/api-request";
import { CLIENT_ERROR_CODE } from "@client/constants/shared/errors";
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
      ...jsonRequest(HTTP_METHOD.POST, input),
    });
  }

  private async request(
    path: string,
    options: RequestInit = {},
  ): Promise<WidgetFileDocument> {
    const payload = await requestJson(path, options);
    if (
      !isRecord(payload) ||
      !isDashboardWidget(payload.widget) ||
      !isWidgetEntry(payload.entry)
    ) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return { widget: payload.widget, entry: payload.entry };
  }
}
