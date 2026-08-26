import {
  API_PATH_SEGMENTS,
  FILESYSTEM_API_PATHS,
} from "@/constants/platform/api";
import { HTTP_METHOD } from "@/constants/platform/http";
import type { DirectoryDetailsUseCases } from "@/types/filesystem/directory-details";
import type { FeatureApiHandler } from "@/types/platform/http";
import { assertMethod, readRouteId } from "@/http/filesystem/filesystem-request";
import { jsonResponse } from "@/http/shared/responses";

const DIRECTORY_DETAILS_PATH = new RegExp(
  `^${FILESYSTEM_API_PATHS.DIRECTORIES}/([^/]+)/${API_PATH_SEGMENTS.DETAILS}$`,
);

export class DirectoryDetailsApiHandler implements FeatureApiHandler {
  constructor(private readonly details: DirectoryDetailsUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    const match = DIRECTORY_DETAILS_PATH.exec(url.pathname);
    if (!match) return null;
    assertMethod(request, HTTP_METHOD.GET);
    return jsonResponse({
      details: await this.details.getDetails(readRouteId(match)),
    });
  }
}
