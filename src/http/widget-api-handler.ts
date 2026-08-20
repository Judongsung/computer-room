import {
  API_PATHS,
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
} from "../constants/api";
import { HTTP_ERRORS } from "../constants/errors/http";
import { HTTP_METHOD, HTTP_STATUS } from "../constants/http";
import {
  DEFAULT_PAGE_LIMIT,
  DEFAULT_PAGE_OFFSET,
  MAX_PAGE_LIMIT,
} from "../constants/pagination";
import { AppError } from "../domain/errors";
import {
  isChecklistCheckInput,
  isChecklistLabelInput,
  isMemoUpdateInput,
} from "../domain/widget-contract";
import { isWidgetLayoutCollection } from "../domain/widget-layout";
import type { ChecklistUseCases } from "../types/checklist-service";
import type { FeatureApiHandler } from "../types/http";
import type { MemoUseCases } from "../types/memo-service";
import type { WidgetLayoutUseCases } from "../types/widget-service";
import { parseIntegerParameter } from "./query-parameters";
import { readJsonBody } from "./request-body";
import { emptyResponse, jsonResponse } from "./responses";

const MEMO_PATH = new RegExp(
  `^${API_PATHS.WIDGETS}/([^/]+)/${API_PATH_SEGMENTS.MEMO}$`,
);
const CHECKLIST_PATH = new RegExp(
  `^${API_PATHS.WIDGETS}/([^/]+)/${API_PATH_SEGMENTS.CHECKLIST}$`,
);
const CHECKLIST_ITEMS_PATH = new RegExp(
  `^${API_PATHS.WIDGETS}/([^/]+)/${API_PATH_SEGMENTS.CHECKLIST}/${API_PATH_SEGMENTS.ITEMS}$`,
);
const CHECKLIST_ITEM_PATH = new RegExp(
  `^${API_PATHS.WIDGETS}/([^/]+)/${API_PATH_SEGMENTS.CHECKLIST}/${API_PATH_SEGMENTS.ITEMS}/([^/]+)$`,
);
const CHECKLIST_ITEM_CHECK_PATH = new RegExp(
  `^${API_PATHS.WIDGETS}/([^/]+)/${API_PATH_SEGMENTS.CHECKLIST}/${API_PATH_SEGMENTS.ITEMS}/([^/]+)/${API_PATH_SEGMENTS.CHECK}$`,
);
const CHECKLIST_LOGS_PATH = new RegExp(
  `^${API_PATHS.WIDGETS}/([^/]+)/${API_PATH_SEGMENTS.CHECKLIST}/${API_PATH_SEGMENTS.LOGS}$`,
);

export class WidgetApiHandler implements FeatureApiHandler {
  constructor(
    private readonly widgets: WidgetLayoutUseCases,
    private readonly memos: MemoUseCases,
    private readonly checklists: ChecklistUseCases,
  ) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === API_PATHS.WIDGETS) {
      return this.handleWidgets(request);
    }

    const memoMatch = MEMO_PATH.exec(url.pathname);
    if (memoMatch) {
      return this.handleMemo(request, memoMatch[1] ?? "");
    }

    const checkMatch = CHECKLIST_ITEM_CHECK_PATH.exec(url.pathname);
    if (checkMatch) {
      return this.handleChecklistItemCheck(
        request,
        checkMatch[1] ?? "",
        checkMatch[2] ?? "",
      );
    }

    const itemMatch = CHECKLIST_ITEM_PATH.exec(url.pathname);
    if (itemMatch) {
      return this.handleChecklistItem(
        request,
        itemMatch[1] ?? "",
        itemMatch[2] ?? "",
      );
    }

    const itemsMatch = CHECKLIST_ITEMS_PATH.exec(url.pathname);
    if (itemsMatch) {
      return this.handleChecklistItems(request, itemsMatch[1] ?? "");
    }

    const logsMatch = CHECKLIST_LOGS_PATH.exec(url.pathname);
    if (logsMatch) {
      return this.handleChecklistLogs(request, url, logsMatch[1] ?? "");
    }

    const checklistMatch = CHECKLIST_PATH.exec(url.pathname);
    if (checklistMatch) {
      return this.handleChecklist(request, checklistMatch[1] ?? "");
    }

    return null;
  }

  private async handleWidgets(request: Request): Promise<Response> {
    if (request.method === HTTP_METHOD.GET) {
      return jsonResponse({ items: await this.widgets.listWidgets() });
    }
    if (request.method === HTTP_METHOD.PUT) {
      const body = await readJsonBody(request);
      if (!isWidgetLayoutCollection(body)) {
        throw new AppError(HTTP_ERRORS.INVALID_JSON);
      }
      return jsonResponse({
        items: await this.widgets.replaceWidgets(body.items),
      });
    }
    throw methodNotAllowed();
  }

  private async handleMemo(
    request: Request,
    widgetId: string,
  ): Promise<Response> {
    assertMethod(request, HTTP_METHOD.PUT);
    const body = await readJsonBody(request);
    if (!isMemoUpdateInput(body)) {
      throw new AppError(HTTP_ERRORS.INVALID_JSON);
    }
    return jsonResponse(await this.memos.updateMemo(widgetId, body));
  }

  private async handleChecklist(
    request: Request,
    widgetId: string,
  ): Promise<Response> {
    assertMethod(request, HTTP_METHOD.GET);
    return jsonResponse(await this.checklists.getChecklist(widgetId));
  }

  private async handleChecklistItems(
    request: Request,
    widgetId: string,
  ): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const body = await readJsonBody(request);
    if (!isChecklistLabelInput(body)) {
      throw new AppError(HTTP_ERRORS.INVALID_JSON);
    }
    const item = await this.checklists.addItem(widgetId, body);
    return jsonResponse({ item }, HTTP_STATUS.CREATED);
  }

  private async handleChecklistItem(
    request: Request,
    widgetId: string,
    itemId: string,
  ): Promise<Response> {
    if (request.method === HTTP_METHOD.PUT) {
      const body = await readJsonBody(request);
      if (!isChecklistLabelInput(body)) {
        throw new AppError(HTTP_ERRORS.INVALID_JSON);
      }
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

  private async handleChecklistItemCheck(
    request: Request,
    widgetId: string,
    itemId: string,
  ): Promise<Response> {
    assertMethod(request, HTTP_METHOD.PUT);
    const body = await readJsonBody(request);
    if (!isChecklistCheckInput(body)) {
      throw new AppError(HTTP_ERRORS.INVALID_JSON);
    }
    return jsonResponse({
      item: await this.checklists.setItemChecked(widgetId, itemId, body),
    });
  }

  private async handleChecklistLogs(
    request: Request,
    url: URL,
    widgetId: string,
  ): Promise<Response> {
    assertMethod(request, HTTP_METHOD.GET);
    const offset = parseIntegerParameter(
      url.searchParams.get(API_QUERY_PARAMETERS.OFFSET),
      DEFAULT_PAGE_OFFSET,
    );
    const limit = parseIntegerParameter(
      url.searchParams.get(API_QUERY_PARAMETERS.LIMIT),
      DEFAULT_PAGE_LIMIT,
    );
    if (limit < 1 || limit > MAX_PAGE_LIMIT) {
      throw new AppError(HTTP_ERRORS.INVALID_LIMIT);
    }
    return jsonResponse(
      await this.checklists.listLogs(widgetId, offset, limit),
    );
  }
}

function assertMethod(request: Request, expected: string): void {
  if (request.method !== expected) {
    throw methodNotAllowed();
  }
}

function methodNotAllowed(): AppError {
  return new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
}
