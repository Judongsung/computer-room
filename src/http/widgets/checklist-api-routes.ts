import { API_PATHS, API_PATH_SEGMENTS, API_QUERY_PARAMETERS } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { API_ROUTE_PATTERN } from "@/constants/platform/http-route";
import { CHECKLIST_ERRORS } from "@/constants/widgets/errors/checklist";
import { HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { CHECKLIST_LOG_PAGE_LIMIT, DEFAULT_PAGE_OFFSET } from "@/constants/filesystem/pagination";
import { AppError } from "@/domain/shared/errors";
import { isChecklistCheckInput, isChecklistLabelInput } from "@/domain/widgets/widget-contract";
import {
  createExactApiRoutePattern,
  readApiRouteSegment,
} from "@/http/shared/api-route";
import { parseIntegerParameter } from "@/http/shared/query-parameters";
import { readJsonBody } from "@/http/shared/request-body";
import { emptyResponse, jsonResponse } from "@/http/shared/responses";
import { assertMethod, methodNotAllowed } from "@/http/widgets/widget-http";
import type { ChecklistUseCases } from "@/types/widgets/checklist-service";

const CHECKLIST_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGETS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.CHECKLIST,
);
const CHECKLIST_ITEMS_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGETS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.CHECKLIST,
  API_PATH_SEGMENTS.ITEMS,
);
const CHECKLIST_ITEM_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGETS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.CHECKLIST,
  API_PATH_SEGMENTS.ITEMS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
);
const CHECKLIST_ITEM_CHECK_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGETS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.CHECKLIST,
  API_PATH_SEGMENTS.ITEMS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.CHECK,
);
const CHECKLIST_LOGS_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGETS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.CHECKLIST,
  API_PATH_SEGMENTS.LOGS,
);

export class ChecklistApiRoutes {
  constructor(private readonly checklists: ChecklistUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    const checkMatch = CHECKLIST_ITEM_CHECK_PATH.exec(url.pathname);
    if (checkMatch) {
      return this.setChecked(
        request,
        readApiRouteSegment(checkMatch),
        readApiRouteSegment(checkMatch, 2),
      );
    }
    const itemMatch = CHECKLIST_ITEM_PATH.exec(url.pathname);
    if (itemMatch) {
      return this.handleItem(
        request,
        readApiRouteSegment(itemMatch),
        readApiRouteSegment(itemMatch, 2),
      );
    }
    const itemsMatch = CHECKLIST_ITEMS_PATH.exec(url.pathname);
    if (itemsMatch) return this.addItem(request, readApiRouteSegment(itemsMatch));
    const logsMatch = CHECKLIST_LOGS_PATH.exec(url.pathname);
    if (logsMatch) {
      return this.listLogs(request, url, readApiRouteSegment(logsMatch));
    }
    const checklistMatch = CHECKLIST_PATH.exec(url.pathname);
    if (!checklistMatch) return null;
    if (request.method === HTTP_METHOD.PATCH) {
      const input = await readJsonBody(request);
      return jsonResponse(await this.checklists.changeRepeatCycle(readApiRouteSegment(checklistMatch), input && typeof input === "object" && "repeatCycle" in input ? input.repeatCycle : undefined));
    }
    assertMethod(request, HTTP_METHOD.GET);
    return jsonResponse(
      await this.checklists.getChecklist(readApiRouteSegment(checklistMatch)),
    );
  }

  private async addItem(request: Request, widgetId: string): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const body = await readJsonBody(request);
    if (!isChecklistLabelInput(body)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
    return jsonResponse(
      { item: await this.checklists.addItem(widgetId, body) },
      HTTP_STATUS.CREATED,
    );
  }

  private async handleItem(
    request: Request,
    widgetId: string,
    itemId: string,
  ): Promise<Response> {
    if (request.method === HTTP_METHOD.PUT) {
      const body = await readJsonBody(request);
      if (!isChecklistLabelInput(body)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
      return jsonResponse({
        item: await this.checklists.updateItem(widgetId, itemId, body),
      });
    }
    if (request.method === HTTP_METHOD.DELETE) {
      await this.checklists.deleteItem(widgetId, itemId);
      return emptyResponse();
    }
    throw methodNotAllowed();
  }

  private async setChecked(
    request: Request,
    widgetId: string,
    itemId: string,
  ): Promise<Response> {
    assertMethod(request, HTTP_METHOD.PUT);
    const body = await readJsonBody(request);
    if (!isChecklistCheckInput(body)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
    return jsonResponse({
      item: await this.checklists.setItemChecked(widgetId, itemId, body),
    });
  }

  private async listLogs(
    request: Request,
    url: URL,
    widgetId: string,
  ): Promise<Response> {
    assertMethod(request, HTTP_METHOD.GET);
    const offset = parseIntegerParameter(url.searchParams.get(API_QUERY_PARAMETERS.OFFSET), DEFAULT_PAGE_OFFSET);
    const limit = parseIntegerParameter(url.searchParams.get(API_QUERY_PARAMETERS.LIMIT), CHECKLIST_LOG_PAGE_LIMIT);
    if (limit < 1 || limit > CHECKLIST_LOG_PAGE_LIMIT) {
      throw new AppError(CHECKLIST_ERRORS.INVALID_LOG_LIMIT);
    }
    return jsonResponse(
      await this.checklists.listLogs(widgetId, offset, limit),
    );
  }
}
