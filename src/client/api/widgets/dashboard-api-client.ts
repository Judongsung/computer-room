import {
  API_PATHS,
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
} from "@/constants/platform/api";
import { HTTP_METHOD } from "@/constants/platform/http";
import {
  isChecklistItem,
  isChecklistLogPage,
  isDailyChecklistData,
  isDashboardWidgetCollection,
  isDashboardWidget,
  isMemoData,
} from "@/domain/widgets/widget-contract";
import type { SessionInfo } from "@/types/platform/auth";
import type {
  ChecklistItem,
  ChecklistLogPage,
  DailyChecklistData,
  DashboardWidget,
  MemoData,
  WidgetLayout,
  CreateWidgetInput,
} from "@/types/widgets/widget";
import type {
  FilesystemWidgetEntry,
  SaveWidgetFileInput,
} from "@/types/filesystem/filesystem";
import { CLIENT_ERROR_CODE } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type { DashboardGateway } from "@client/types/widgets/api";
import { isWidgetEntry } from "@client/api/filesystem/filesystem-api-contract";
import { isRecord } from "@client/api/shared/api-contract";
import { jsonRequest, requestJson } from "@client/api/shared/api-request";

export class DashboardApiClient implements DashboardGateway {
  async getSession(): Promise<SessionInfo> {
    const value = await requestJson(API_PATHS.SESSION);
    if (!isSessionInfo(value)) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return value;
  }

  async listWidgets(): Promise<DashboardWidget[]> {
    const value = await requestJson(API_PATHS.WIDGETS);
    if (!isDashboardWidgetCollection(value)) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return [...value.items];
  }

  async replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<DashboardWidget[]> {
    const value = await requestJson(
      API_PATHS.WIDGETS,
      jsonRequest(HTTP_METHOD.PUT, { items: widgets }),
    );
    if (!isDashboardWidgetCollection(value)) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return [...value.items];
  }

  async createWidget(input: CreateWidgetInput): Promise<DashboardWidget> {
    const value = await requestJson(
      API_PATHS.WIDGETS,
      jsonRequest(HTTP_METHOD.POST, input),
    );
    return readWidgetEnvelope(value);
  }

  async saveWidgetFile(
    widgetId: string,
    input: SaveWidgetFileInput,
  ): Promise<{ widget: DashboardWidget; entry: FilesystemWidgetEntry }> {
    const value = await requestJson(
      `${widgetPath(widgetId)}/${API_PATH_SEGMENTS.FILE}`,
      jsonRequest(HTTP_METHOD.POST, {
        parentId: input.parentId,
        name: input.name,
        ...(input.desktopPlacement
          ? {
              desktopTargetIndex: input.desktopPlacement.targetIndex,
              desktopCapacity: input.desktopPlacement.capacity,
            }
          : {}),
      }),
    );
    if (
      !isRecord(value) ||
      !isDashboardWidget(value.widget) ||
      !isWidgetEntry(value.entry)
    ) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return { widget: value.widget, entry: value.entry };
  }

  async openWidget(widgetId: string): Promise<DashboardWidget> {
    const value = await requestJson(
      `${widgetPath(widgetId)}/${API_PATH_SEGMENTS.OPEN}`,
      { method: HTTP_METHOD.POST },
    );
    return readWidgetEnvelope(value);
  }

  async closeWidget(widgetId: string): Promise<void> {
    await requestJson(`${widgetPath(widgetId)}/${API_PATH_SEGMENTS.CLOSE}`, {
      method: HTTP_METHOD.POST,
    });
  }

  async discardWidget(widgetId: string): Promise<void> {
    await requestJson(widgetPath(widgetId), {
      method: HTTP_METHOD.DELETE,
    });
  }

  async updateMemo(widgetId: string, markdown: string): Promise<MemoData> {
    const value = await requestJson(
      memoPath(widgetId),
      jsonRequest(HTTP_METHOD.PUT, { markdown }),
    );
    if (!isMemoData(value)) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return value;
  }

  async getChecklist(widgetId: string): Promise<DailyChecklistData> {
    const value = await requestJson(checklistPath(widgetId));
    if (!isDailyChecklistData(value)) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return value;
  }

  async addChecklistItem(
    widgetId: string,
    label: string,
  ): Promise<ChecklistItem> {
    const value = await requestJson(
      checklistItemsPath(widgetId),
      jsonRequest(HTTP_METHOD.POST, { label }),
    );
    return readChecklistItemEnvelope(value);
  }

  async updateChecklistItem(
    widgetId: string,
    itemId: string,
    label: string,
  ): Promise<ChecklistItem> {
    const value = await requestJson(
      checklistItemPath(widgetId, itemId),
      jsonRequest(HTTP_METHOD.PUT, { label }),
    );
    return readChecklistItemEnvelope(value);
  }

  async deleteChecklistItem(
    widgetId: string,
    itemId: string,
  ): Promise<void> {
    await requestJson(checklistItemPath(widgetId, itemId), {
      method: HTTP_METHOD.DELETE,
    });
  }

  async setChecklistItemChecked(
    widgetId: string,
    itemId: string,
    checked: boolean,
  ): Promise<ChecklistItem> {
    const value = await requestJson(
      `${checklistItemPath(widgetId, itemId)}/${API_PATH_SEGMENTS.CHECK}`,
      jsonRequest(HTTP_METHOD.PUT, { checked }),
    );
    return readChecklistItemEnvelope(value);
  }

  async listChecklistLogs(
    widgetId: string,
    offset = 0,
  ): Promise<ChecklistLogPage> {
    const query = new URLSearchParams({
      [API_QUERY_PARAMETERS.OFFSET]: String(offset),
    });
    const value = await requestJson(
      `${checklistPath(widgetId)}/${API_PATH_SEGMENTS.LOGS}?${query}`,
    );
    if (!isChecklistLogPage(value)) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return value;
  }

}

function memoPath(widgetId: string): string {
  return `${widgetPath(widgetId)}/${API_PATH_SEGMENTS.MEMO}`;
}

function checklistPath(widgetId: string): string {
  return `${widgetPath(widgetId)}/${API_PATH_SEGMENTS.CHECKLIST}`;
}

function checklistItemsPath(widgetId: string): string {
  return `${checklistPath(widgetId)}/${API_PATH_SEGMENTS.ITEMS}`;
}

function checklistItemPath(widgetId: string, itemId: string): string {
  return `${checklistItemsPath(widgetId)}/${encodeURIComponent(itemId)}`;
}

function widgetPath(widgetId: string): string {
  return `${API_PATHS.WIDGETS}/${encodeURIComponent(widgetId)}`;
}

function readChecklistItemEnvelope(value: unknown): ChecklistItem {
  if (!isRecord(value) || !isChecklistItem(value.item)) {
    throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
  }
  return value.item;
}

function readWidgetEnvelope(value: unknown): DashboardWidget {
  if (!isRecord(value) || !isDashboardWidget(value.widget)) {
    throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
  }
  return value.widget;
}

function isSessionInfo(value: unknown): value is SessionInfo {
  if (!isRecord(value) || !isRecord(value.filePolicy)) {
    return false;
  }

  return (
    typeof value.email === "string" &&
    typeof value.logoutUrl === "string" &&
    typeof value.filePolicy.maxUploadSizeBytes === "number"
  );
}
