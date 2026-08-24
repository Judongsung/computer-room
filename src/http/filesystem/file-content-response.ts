import {
  CONTENT_DISPOSITION_MODE,
  FILE_CONTENT_RESPONSE_HEADERS,
  FILE_DOWNLOAD_RESPONSE_HEADERS,
  HTTP_HEADERS,
  HTTP_METHOD,
  HTTP_RANGE_UNIT,
  HTTP_STATUS,
  THUMBNAIL_RESPONSE_HEADERS,
} from "@/constants/platform/http";
import { FileRangeNotSatisfiableError } from "@/domain/filesystem/file-content-error";
import type { FileUseCases } from "@/types/filesystem/file-service";
import type { ThumbnailUseCases } from "@/types/filesystem/thumbnail";
import { parseRangeHeader } from "./byte-range";
import { assertMethod, contentDisposition } from "./filesystem-request";
import { jsonResponse } from "@/http/shared/responses";

export async function fileDownloadResponse(
  files: FileUseCases,
  request: Request,
  id: string,
): Promise<Response> {
  assertMethod(request, HTTP_METHOD.GET);
  const { entry, object } = await files.downloadFile(id);
  return new Response(object.body, {
    headers: {
      ...FILE_DOWNLOAD_RESPONSE_HEADERS,
      [HTTP_HEADERS.CONTENT_DISPOSITION]: contentDisposition(entry.name, CONTENT_DISPOSITION_MODE.ATTACHMENT),
      [HTTP_HEADERS.CONTENT_LENGTH]: String(object.size),
      [HTTP_HEADERS.CONTENT_TYPE]: object.contentType,
      [HTTP_HEADERS.ETAG]: object.httpEtag,
    },
  });
}

export async function fileContentResponse(
  files: FileUseCases,
  request: Request,
  id: string,
): Promise<Response> {
  assertMethod(request, HTTP_METHOD.GET);
  try {
    const { entry, object, range } = await files.streamFile(
      id,
      parseRangeHeader(request.headers.get(HTTP_HEADERS.RANGE)),
    );
    const headers = new Headers(FILE_CONTENT_RESPONSE_HEADERS);
    headers.set(HTTP_HEADERS.CONTENT_DISPOSITION, contentDisposition(entry.name, CONTENT_DISPOSITION_MODE.INLINE));
    headers.set(HTTP_HEADERS.CONTENT_LENGTH, String(range?.length ?? object.size));
    headers.set(HTTP_HEADERS.CONTENT_TYPE, object.contentType);
    headers.set(HTTP_HEADERS.ETAG, object.httpEtag);
    if (range) {
      const lastByte = range.offset + range.length - 1;
      headers.set(HTTP_HEADERS.CONTENT_RANGE, `${HTTP_RANGE_UNIT} ${range.offset}-${lastByte}/${object.size}`);
    }
    return new Response(object.body, { status: range ? HTTP_STATUS.PARTIAL_CONTENT : HTTP_STATUS.OK, headers });
  } catch (error) {
    if (error instanceof FileRangeNotSatisfiableError) {
      return jsonResponse(
        { error: { code: error.code, message: error.message } },
        error.status,
        { ...FILE_CONTENT_RESPONSE_HEADERS, [HTTP_HEADERS.CONTENT_RANGE]: `${HTTP_RANGE_UNIT} */${error.totalSize}` },
      );
    }
    throw error;
  }
}

export async function thumbnailResponse(
  thumbnails: ThumbnailUseCases,
  request: Request,
  id: string,
): Promise<Response> {
  assertMethod(request, HTTP_METHOD.GET);
  const object = await thumbnails.getThumbnail(id);
  const headers = new Headers(THUMBNAIL_RESPONSE_HEADERS);
  headers.set(HTTP_HEADERS.CONTENT_LENGTH, String(object.size));
  headers.set(HTTP_HEADERS.CONTENT_TYPE, object.contentType);
  headers.set(HTTP_HEADERS.ETAG, object.httpEtag);
  return new Response(object.body, { headers });
}
