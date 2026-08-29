import { HTTP_HEADERS, HTTP_MEDIA_TYPE } from "@/constants/platform/http";
import { API_REQUEST_OPTIONS } from "@client/constants/shared/api";
import { CLIENT_ERROR_CODE } from "@client/constants/shared/errors";
import { clientErrorDefinition } from "@client/errors/client-error";
import { ApiError } from "@client/errors/api-error";
import { isRecord } from "@client/api/shared/api-contract";

export function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON },
    body: JSON.stringify(body),
  };
}

export async function requestJson(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(path, {
    credentials: API_REQUEST_OPTIONS.CREDENTIALS,
    ...options,
  });
  const payload = response.status === 204
    ? null
    : await response.json().catch(() => null);

  if (!response.ok) {
    const error = readApiError(payload);
    throw new ApiError(error.code, error.message, response.status);
  }

  return payload;
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
  return clientErrorDefinition(CLIENT_ERROR_CODE.REQUEST_FAILED);
}
