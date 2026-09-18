import { API_QUERY_PARAMETERS, FILESYSTEM_API_PATHS } from "@/constants/platform/api";
import { HTTP_METHOD } from "@/constants/platform/http";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { FILESYSTEM_PAGE_LIMIT } from "@/constants/filesystem/pagination";
import { FILESYSTEM_SEARCH_KIND } from "@/constants/filesystem/search";
import { isFilesystemSearchKind } from "@/domain/filesystem/search/search-query";
import { AppError } from "@/domain/shared/errors";
import { assertMethod, readPageParameters } from "@/http/filesystem/filesystem-request";
import { jsonResponse } from "@/http/shared/responses";
import type { FeatureApiHandler } from "@/types/platform/http";
import type { FilesystemSearchUseCases } from "@/types/filesystem/search/search";

export class FilesystemSearchApiRoutes implements FeatureApiHandler {
  constructor(private readonly search: FilesystemSearchUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname !== FILESYSTEM_API_PATHS.SEARCH) return null;
    assertMethod(request, HTTP_METHOD.GET);
    const kind = url.searchParams.get(API_QUERY_PARAMETERS.SEARCH_KIND) ?? FILESYSTEM_SEARCH_KIND.ALL;
    if (!isFilesystemSearchKind(kind)) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_SEARCH);
    }
    const directoryId = url.searchParams.get(API_QUERY_PARAMETERS.SEARCH_DIRECTORY_ID);
    const { offset, limit } = readPageParameters(url, FILESYSTEM_PAGE_LIMIT, HTTP_ERRORS.INVALID_FILESYSTEM_LIMIT);
    return jsonResponse(await this.search.search(
      {
        q: url.searchParams.get(API_QUERY_PARAMETERS.SEARCH_QUERY) ?? "",
        kind,
        ...(directoryId === null ? {} : { directoryId }),
      },
      offset,
      limit,
    ));
  }
}
