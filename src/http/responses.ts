import { HTTP_ERRORS, HTTP_LOG_MESSAGES } from "../constants/errors/http";
import {
  API_RESPONSE_HEADERS,
  EMPTY_RESPONSE_HEADERS,
  HTTP_STATUS,
} from "../constants/http";
import { AppError } from "../domain/errors";

export function jsonResponse(
  data: unknown,
  status: number = HTTP_STATUS.OK,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: API_RESPONSE_HEADERS,
  });
}

export function emptyResponse(status: number = HTTP_STATUS.NO_CONTENT): Response {
  return new Response(null, {
    status,
    headers: EMPTY_RESPONSE_HEADERS,
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  }

  console.error(HTTP_LOG_MESSAGES.UNHANDLED_API_ERROR, error);
  const internalError = HTTP_ERRORS.INTERNAL_ERROR;
  return jsonResponse(
    {
      error: {
        code: internalError.code,
        message: internalError.message,
      },
    },
    internalError.status,
  );
}
