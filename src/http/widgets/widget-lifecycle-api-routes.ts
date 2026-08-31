import { API_PATHS, API_PATH_SEGMENTS } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { API_ROUTE_PATTERN } from "@/constants/platform/http-route";
import { HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { WIDGET_TYPE_VALUES } from "@/constants/widgets/widget";
import { AppError } from "@/domain/shared/errors";
import { isWidgetLayoutCollection } from "@/domain/widgets/widget-layout";
import {
  createExactApiRoutePattern,
  readApiRouteSegment,
} from "@/http/shared/api-route";
import { readJsonBody } from "@/http/shared/request-body";
import { emptyResponse, jsonResponse } from "@/http/shared/responses";
import { assertMethod, isRecord, methodNotAllowed, readRecordBody } from "@/http/widgets/widget-http";
import type { WidgetLayoutUseCases } from "@/types/widgets/widget-service";
import type { WidgetFileUseCases } from "@/types/widgets/widget-file-service";
import type { WidgetType } from "@/types/widgets/widget";

const WIDGET_FILE_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGETS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.FILE,
);
const WIDGET_OPEN_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGETS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.OPEN,
);
const WIDGET_CLOSE_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGETS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.CLOSE,
);
const WIDGET_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGETS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
);

export class WidgetLifecycleApiRoutes {
  constructor(
    private readonly widgets: WidgetLayoutUseCases,
    private readonly widgetFiles: WidgetFileUseCases,
  ) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === API_PATHS.WIDGETS) return this.handleCollection(request);
    const fileMatch = WIDGET_FILE_PATH.exec(url.pathname);
    if (fileMatch) return this.saveFile(request, readApiRouteSegment(fileMatch));
    const openMatch = WIDGET_OPEN_PATH.exec(url.pathname);
    if (openMatch) {
      assertMethod(request, HTTP_METHOD.POST);
      return jsonResponse({ widget: await this.widgets.openWidget(readApiRouteSegment(openMatch)) });
    }
    const closeMatch = WIDGET_CLOSE_PATH.exec(url.pathname);
    if (closeMatch) {
      assertMethod(request, HTTP_METHOD.POST);
      await this.widgets.closeWidget(readApiRouteSegment(closeMatch));
      return emptyResponse();
    }
    const widgetMatch = WIDGET_PATH.exec(url.pathname);
    if (!widgetMatch) return null;
    assertMethod(request, HTTP_METHOD.DELETE);
    await this.widgets.discardWidget(readApiRouteSegment(widgetMatch));
    return emptyResponse();
  }

  private async handleCollection(request: Request): Promise<Response> {
    if (request.method === HTTP_METHOD.GET) return jsonResponse({ items: await this.widgets.listWidgets() });
    if (request.method === HTTP_METHOD.PUT) {
      const body = await readJsonBody(request);
      if (!isWidgetLayoutCollection(body)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
      return jsonResponse({ items: await this.widgets.replaceWidgets(body.items) });
    }
    if (request.method === HTTP_METHOD.POST) {
      const body = await readRecordBody(request);
      if (!isWidgetType(body.type) || !isPosition(body.position) || !isSize(body.size)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
      const result = await this.widgets.createWidget({ type: body.type, position: body.position, size: body.size });
      return jsonResponse({ widget: result.widget }, result.created ? HTTP_STATUS.CREATED : HTTP_STATUS.OK);
    }
    throw methodNotAllowed();
  }

  private async saveFile(request: Request, widgetId: string): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const body = await readRecordBody(request);
    if (typeof body.parentId !== "string" || typeof body.name !== "string") throw new AppError(HTTP_ERRORS.INVALID_JSON);
    const desktopPlacement = readDesktopPlacement(body);
    return jsonResponse(await this.widgetFiles.save(widgetId, {
      parentId: body.parentId,
      name: body.name,
      ...(desktopPlacement === undefined ? {} : { desktopPlacement }),
    }), HTTP_STATUS.CREATED);
  }
}

function readDesktopPlacement(value: Record<string, unknown>) {
  if (value.desktopTargetIndex === undefined && value.desktopCapacity === undefined) return undefined;
  if (typeof value.desktopTargetIndex !== "number" || typeof value.desktopCapacity !== "number") throw new AppError(HTTP_ERRORS.INVALID_JSON);
  return { targetIndex: value.desktopTargetIndex, capacity: value.desktopCapacity };
}

function isPosition(value: unknown): value is { readonly x: number; readonly y: number } {
  return isRecord(value) && typeof value.x === "number" && typeof value.y === "number";
}

function isSize(value: unknown): value is { readonly width: number; readonly height: number } {
  return isRecord(value) && typeof value.width === "number" && typeof value.height === "number";
}

function isWidgetType(value: unknown): value is WidgetType {
  return WIDGET_TYPE_VALUES.some((type) => value === type);
}
