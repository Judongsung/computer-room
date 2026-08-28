import {
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
  FILESYSTEM_API_PATHS,
} from "@/constants/platform/api";
import {
  HTTP_HEADERS,
  HTTP_METHOD,
  HTTP_STATUS,
} from "@/constants/platform/http";
import type { FileTransferUseCases } from "@/types/filesystem/file-transfer-service";
import type { ThumbnailUseCases } from "@/types/filesystem/thumbnail";
import type { FeatureApiHandler } from "@/types/platform/http";
import {
  fileContentResponse,
  fileDownloadResponse,
  thumbnailResponse,
} from "@/http/filesystem/file-content-response";
import {
  assertMethod,
  readDesktopPlacementFromQuery,
  readRouteId,
} from "@/http/filesystem/filesystem-request";
import { readDeclaredFileSize } from "@/http/filesystem/file-upload-request";
import { jsonResponse } from "@/http/shared/responses";

const FILE_DOWNLOAD_PATH = new RegExp(
  `^${FILESYSTEM_API_PATHS.FILES}/([^/]+)/${API_PATH_SEGMENTS.DOWNLOAD}$`,
);
const FILE_CONTENT_PATH = new RegExp(
  `^${FILESYSTEM_API_PATHS.FILES}/([^/]+)/${API_PATH_SEGMENTS.CONTENT}$`,
);
const FILE_THUMBNAIL_PATH = new RegExp(
  `^${FILESYSTEM_API_PATHS.FILES}/([^/]+)/${API_PATH_SEGMENTS.THUMBNAIL}$`,
);

export class FileTransferApiRoutes implements FeatureApiHandler {
  constructor(
    private readonly files: FileTransferUseCases,
    private readonly thumbnails: ThumbnailUseCases,
  ) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === FILESYSTEM_API_PATHS.FILES) {
      return this.upload(request, url);
    }

    const downloadMatch = FILE_DOWNLOAD_PATH.exec(url.pathname);
    if (downloadMatch) {
      return fileDownloadResponse(this.files, request, readRouteId(downloadMatch));
    }

    const contentMatch = FILE_CONTENT_PATH.exec(url.pathname);
    if (contentMatch) {
      return fileContentResponse(this.files, request, readRouteId(contentMatch));
    }

    const thumbnailMatch = FILE_THUMBNAIL_PATH.exec(url.pathname);
    if (thumbnailMatch) {
      return thumbnailResponse(
        this.thumbnails,
        request,
        readRouteId(thumbnailMatch),
      );
    }

    return null;
  }

  private async upload(request: Request, url: URL): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const file = await this.files.uploadFile({
      parentId: url.searchParams.get(API_QUERY_PARAMETERS.PARENT_ID),
      originalName:
        url.searchParams.get(API_QUERY_PARAMETERS.FILE_NAME) ?? "",
      contentType: request.headers.get(HTTP_HEADERS.CONTENT_TYPE),
      declaredSize: readDeclaredFileSize(request),
      body: request.body,
      ...readDesktopPlacementFromQuery(url),
    });
    return jsonResponse({ file }, HTTP_STATUS.CREATED);
  }
}
