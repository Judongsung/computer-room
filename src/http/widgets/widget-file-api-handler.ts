import { API_PATHS } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { API_ROUTE_PATTERN } from "@/constants/platform/http-route";
import { HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import { isCreateWidgetFileInput } from "@/domain/widgets/widget-file-contract";
import {
  createExactApiRoutePattern,
  readApiRouteSegment,
} from "@/http/shared/api-route";
import { readJsonBody } from "@/http/shared/request-body";
import { jsonResponse } from "@/http/shared/responses";
import { assertMethod } from "@/http/widgets/widget-http";
import type { FeatureApiHandler } from "@/types/platform/http";
import type { WidgetFileUseCases } from "@/types/widgets/widget-file-service";

const WIDGET_FILE_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGET_FILES,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
);

export class WidgetFileApiHandler implements FeatureApiHandler {
  constructor(private readonly widgetFiles: WidgetFileUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === API_PATHS.WIDGET_FILES) {
      assertMethod(request, HTTP_METHOD.POST);
      const body = await readJsonBody(request);
      if (!isCreateWidgetFileInput(body)) {
        throw new AppError(HTTP_ERRORS.INVALID_JSON);
      }
      return jsonResponse(
        await this.widgetFiles.create(body),
        HTTP_STATUS.CREATED,
      );
    }
    const match = WIDGET_FILE_PATH.exec(url.pathname);
    if (!match) return null;
    assertMethod(request, HTTP_METHOD.GET);
    return jsonResponse(await this.widgetFiles.get(readApiRouteSegment(match)));
  }
}
