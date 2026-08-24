import { API_PATHS, API_PATH_SEGMENTS, API_QUERY_PARAMETERS } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { CHECKLIST_LOG_PAGE_LIMIT, DEFAULT_PAGE_OFFSET } from "@/constants/filesystem/pagination";
import { AppError } from "@/domain/shared/errors";
import { isChecklistCheckInput, isChecklistLabelInput } from "@/domain/widgets/widget-contract";
import { parseIntegerParameter } from "@/http/shared/query-parameters";
import { readJsonBody } from "@/http/shared/request-body";
import { emptyResponse, jsonResponse } from "@/http/shared/responses";
import { assertMethod, decodeId, methodNotAllowed } from "@/http/widgets/widget-http";
import type { ChecklistUseCases } from "@/types/widgets/checklist-service";

const CHECKLIST_PATH = new RegExp(`^${API_PATHS.WIDGETS}/([^/]+)/${API_PATH_SEGMENTS.CHECKLIST}$`);
const CHECKLIST_ITEMS_PATH = new RegExp(`^${API_PATHS.WIDGETS}/([^/]+)/${API_PATH_SEGMENTS.CHECKLIST}/${API_PATH_SEGMENTS.ITEMS}$`);
const CHECKLIST_ITEM_PATH = new RegExp(`^${API_PATHS.WIDGETS}/([^/]+)/${API_PATH_SEGMENTS.CHECKLIST}/${API_PATH_SEGMENTS.ITEMS}/([^/]+)$`);
const CHECKLIST_ITEM_CHECK_PATH = new RegExp(`^${API_PATHS.WIDGETS}/([^/]+)/${API_PATH_SEGMENTS.CHECKLIST}/${API_PATH_SEGMENTS.ITEMS}/([^/]+)/${API_PATH_SEGMENTS.CHECK}$`);
const CHECKLIST_LOGS_PATH = new RegExp(`^${API_PATHS.WIDGETS}/([^/]+)/${API_PATH_SEGMENTS.CHECKLIST}/${API_PATH_SEGMENTS.LOGS}$`);

export class ChecklistApiRoutes {
  constructor(private readonly checklists: ChecklistUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    const checkMatch = CHECKLIST_ITEM_CHECK_PATH.exec(url.pathname);
    if (checkMatch) return this.setChecked(request, checkMatch[1], checkMatch[2]);
    const itemMatch = CHECKLIST_ITEM_PATH.exec(url.pathname);
    if (itemMatch) return this.handleItem(request, itemMatch[1], itemMatch[2]);
    const itemsMatch = CHECKLIST_ITEMS_PATH.exec(url.pathname);
    if (itemsMatch) return this.addItem(request, itemsMatch[1]);
    const logsMatch = CHECKLIST_LOGS_PATH.exec(url.pathname);
    if (logsMatch) return this.listLogs(request, url, logsMatch[1]);
    const checklistMatch = CHECKLIST_PATH.exec(url.pathname);
    if (!checklistMatch) return null;
    assertMethod(request, HTTP_METHOD.GET);
    return jsonResponse(await this.checklists.getChecklist(decodeId(checklistMatch[1])));
  }

  private async addItem(request: Request, widgetId?: string): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const body = await readJsonBody(request);
    if (!isChecklistLabelInput(body)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
    return jsonResponse({ item: await this.checklists.addItem(decodeId(widgetId), body) }, HTTP_STATUS.CREATED);
  }

  private async handleItem(request: Request, widgetId?: string, itemId?: string): Promise<Response> {
    if (request.method === HTTP_METHOD.PUT) {
      const body = await readJsonBody(request);
      if (!isChecklistLabelInput(body)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
      return jsonResponse({ item: await this.checklists.updateItem(decodeId(widgetId), decodeId(itemId), body) });
    }
    if (request.method === HTTP_METHOD.DELETE) {
      await this.checklists.deleteItem(decodeId(widgetId), decodeId(itemId));
      return emptyResponse();
    }
    throw methodNotAllowed();
  }

  private async setChecked(request: Request, widgetId?: string, itemId?: string): Promise<Response> {
    assertMethod(request, HTTP_METHOD.PUT);
    const body = await readJsonBody(request);
    if (!isChecklistCheckInput(body)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
    return jsonResponse({ item: await this.checklists.setItemChecked(decodeId(widgetId), decodeId(itemId), body) });
  }

  private async listLogs(request: Request, url: URL, widgetId?: string): Promise<Response> {
    assertMethod(request, HTTP_METHOD.GET);
    const offset = parseIntegerParameter(url.searchParams.get(API_QUERY_PARAMETERS.OFFSET), DEFAULT_PAGE_OFFSET);
    const limit = parseIntegerParameter(url.searchParams.get(API_QUERY_PARAMETERS.LIMIT), CHECKLIST_LOG_PAGE_LIMIT);
    if (limit < 1 || limit > CHECKLIST_LOG_PAGE_LIMIT) throw new AppError(HTTP_ERRORS.INVALID_LIMIT);
    return jsonResponse(await this.checklists.listLogs(decodeId(widgetId), offset, limit));
  }
}
