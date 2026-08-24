import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import {
  HTTP_HEADERS,
  HTTP_MEDIA_TYPE,
  MAX_JSON_REQUEST_BYTES,
} from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers
    .get(HTTP_HEADERS.CONTENT_TYPE)
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== HTTP_MEDIA_TYPE.JSON) {
    throw new AppError(HTTP_ERRORS.UNSUPPORTED_MEDIA_TYPE);
  }

  const declaredLength = request.headers.get(HTTP_HEADERS.CONTENT_LENGTH);
  if (
    declaredLength !== null &&
    (!/^\d+$/.test(declaredLength) ||
      Number(declaredLength) > MAX_JSON_REQUEST_BYTES)
  ) {
    throw new AppError(HTTP_ERRORS.REQUEST_BODY_TOO_LARGE);
  }

  if (!request.body) {
    throw new AppError(HTTP_ERRORS.INVALID_JSON);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalLength += value.byteLength;
      if (totalLength > MAX_JSON_REQUEST_BYTES) {
        await reader.cancel();
        throw new AppError(HTTP_ERRORS.REQUEST_BODY_TOO_LARGE);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new AppError(HTTP_ERRORS.INVALID_JSON);
  }
}
