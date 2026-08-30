import { HTTP_LOG_MESSAGES } from "@/constants/platform/errors/http";
import {
  API_RESPONSE_HEADERS,
  EMPTY_RESPONSE_HEADERS,
  HTTP_STATUS,
} from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import { publicErrorDefinition } from "@/http/shared/public-error";

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

export function errorResponse(error: unknown): Response {
  if (!(error instanceof AppError)) {
    console.error(HTTP_LOG_MESSAGES.UNHANDLED_API_ERROR, error);
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
  );
}
