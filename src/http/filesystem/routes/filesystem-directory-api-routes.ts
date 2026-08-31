import { FILESYSTEM_PAGE_LIMIT } from "@/constants/filesystem/pagination";
import {
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
  FILESYSTEM_API_PATHS,
} from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { API_ROUTE_PATTERN } from "@/constants/platform/http-route";
import { HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { requireFilesystemDirectorySort } from "@/domain/filesystem/filesystem-sort";
import { AppError } from "@/domain/shared/errors";
import type { FilesystemDirectoryUseCases } from "@/types/filesystem/services/directory-service";
import type { FeatureApiHandler } from "@/types/platform/http";
import {
  assertMethod,
  readDesktopPlacement,
  readOptionalString,
  readPageParameters,
  readRequiredJsonObject,
} from "@/http/filesystem/filesystem-request";
import {
  createExactApiRoutePattern,
  readApiRouteSegment,
} from "@/http/shared/api-route";
import { jsonResponse } from "@/http/shared/responses";

const DIRECTORY_SORT_PATH = createExactApiRoutePattern(
  FILESYSTEM_API_PATHS.DIRECTORIES,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.SORT,
);

export class FilesystemDirectoryApiRoutes implements FeatureApiHandler {
  constructor(private readonly directories: FilesystemDirectoryUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === FILESYSTEM_API_PATHS.ENTRIES) {
      return this.listEntries(request, url);
    }
    if (url.pathname === FILESYSTEM_API_PATHS.DIRECTORIES) {
      return this.createDirectory(request);
    }

    const sortMatch = DIRECTORY_SORT_PATH.exec(url.pathname);
    if (sortMatch) {
      return this.updateDirectorySort(request, readApiRouteSegment(sortMatch));
    }

    return null;
  }

  private async listEntries(request: Request, url: URL): Promise<Response> {
    assertMethod(request, HTTP_METHOD.GET);
    const { offset, limit } = readPageParameters(
      url,
      FILESYSTEM_PAGE_LIMIT,
      HTTP_ERRORS.INVALID_FILESYSTEM_LIMIT,
    );
    return jsonResponse(
      await this.directories.listDirectory(
        url.searchParams.get(API_QUERY_PARAMETERS.PARENT_ID),
        offset,
        limit,
      ),
    );
  }

  private async createDirectory(request: Request): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const body = await readRequiredJsonObject(request);
    if (typeof body.name !== "string") {
      throw new AppError(HTTP_ERRORS.INVALID_JSON);
    }
    const parentId = readOptionalString(body.parentId);
    const desktopPlacement = readDesktopPlacement(body);
    const directory = await this.directories.createDirectory(
      parentId ?? null,
      body.name,
      desktopPlacement,
    );
    return jsonResponse({ directory }, HTTP_STATUS.CREATED);
  }

  private async updateDirectorySort(
    request: Request,
    id: string,
  ): Promise<Response> {
    assertMethod(request, HTTP_METHOD.PUT);
    const body = await readRequiredJsonObject(request);
    return jsonResponse({
      sort: await this.directories.updateDirectorySort(
        id,
        requireFilesystemDirectorySort(body),
      ),
    });
  }
}
