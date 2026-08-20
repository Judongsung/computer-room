import { API_PATHS } from "../../constants/api";
import {
  HTTP_HEADERS,
  HTTP_MEDIA_TYPE,
  HTTP_METHOD,
} from "../../constants/http";
import { isWidgetLayoutCollection } from "../../domain/widget-layout";
import type { SessionInfo } from "../../types/auth";
import type { WidgetLayout } from "../../types/widget";
import { API_REQUEST_OPTIONS } from "../constants/api";
import { CLIENT_ERRORS } from "../constants/errors";
import { ClientError } from "../errors/client-error";
import type { DashboardGateway } from "../types/api";

export class DashboardApiClient implements DashboardGateway {
  async getSession(): Promise<SessionInfo> {
    const value = await this.requestJson(API_PATHS.SESSION);
    if (!isSessionInfo(value)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value;
  }

  async listWidgets(): Promise<WidgetLayout[]> {
    const value = await this.requestJson(API_PATHS.WIDGETS);
    if (!isWidgetLayoutCollection(value)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return [...value.items];
  }

  async replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<WidgetLayout[]> {
    const value = await this.requestJson(API_PATHS.WIDGETS, {
      method: HTTP_METHOD.PUT,
      headers: {
        [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON,
      },
      body: JSON.stringify({ items: widgets }),
    });
    if (!isWidgetLayoutCollection(value)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return [...value.items];
  }

  private async requestJson(
    url: string,
    options: RequestInit = {},
  ): Promise<unknown> {
    const response = await fetch(url, {
      credentials: API_REQUEST_OPTIONS.CREDENTIALS,
      ...options,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const error = readApiError(payload);
      throw new ApiError(error.code, error.message, response.status);
    }

    return payload;
  }
}

export class ApiError extends ClientError {
  constructor(
    code: string,
    message: string,
    readonly status: number,
  ) {
    super({ code, message });
    this.name = "ApiError";
  }
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

function readApiError(value: unknown): { code: string; message: string } {
  if (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  ) {
    return { code: value.error.code, message: value.error.message };
  }

  return {
    code: CLIENT_ERRORS.REQUEST_FAILED.code,
    message: CLIENT_ERRORS.REQUEST_FAILED.message,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
