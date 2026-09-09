import {
  API_RESPONSE_HEADERS,
  EMPTY_RESPONSE_HEADERS,
  HTTP_STATUS,
} from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import { publicErrorDefinition } from "@/http/shared/public-error";
import { reportUnexpectedApiError } from "@/http/shared/unexpected-error-reporter";

export function jsonResponse(
  data: unknown,
  status: number = HTTP_STATUS.OK,
  additionalHeaders?: HeadersInit,
): Response {
  const headers = new Headers(API_RESPONSE_HEADERS);
  if (additionalHeaders) {
    new Headers(additionalHeaders).forEach((value, name) => headers.set(name, value));
  }
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

export function emptyResponse(
  status: number = HTTP_STATUS.NO_CONTENT,
  additionalHeaders?: HeadersInit,
): Response {
  const headers = new Headers(EMPTY_RESPONSE_HEADERS);
  if (additionalHeaders) {
    new Headers(additionalHeaders).forEach((value, name) => headers.set(name, value));
  }
  return new Response(null, {
    status,
    headers,
  });
}

export function errorResponse(
  error: unknown,
  additionalHeaders?: HeadersInit,
): Response {
  if (!(error instanceof AppError)) {
    reportUnexpectedApiError(error);
  }
  const publicError = publicErrorDefinition(error);
  return jsonResponse(
    {
      error: {
        code: publicError.code,
        message: publicError.message,
      },
    },
    publicError.status,
    additionalHeaders,
  );
}
