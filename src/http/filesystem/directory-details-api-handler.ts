import {
  API_PATH_SEGMENTS,
  FILESYSTEM_API_PATHS,
} from "@/constants/platform/api";
import { API_ROUTE_PATTERN } from "@/constants/platform/http-route";
import { HTTP_METHOD } from "@/constants/platform/http";
import type { DirectoryDetailsUseCases } from "@/types/filesystem/directory-details";
import type { FeatureApiHandler } from "@/types/platform/http";
import { assertMethod } from "@/http/filesystem/filesystem-request";
import {
  createExactApiRoutePattern,
  readApiRouteSegment,
} from "@/http/shared/api-route";
import { jsonResponse } from "@/http/shared/responses";

const DIRECTORY_DETAILS_PATH = createExactApiRoutePattern(
  FILESYSTEM_API_PATHS.DIRECTORIES,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.DETAILS,
);

export class DirectoryDetailsApiHandler implements FeatureApiHandler {
  constructor(private readonly details: DirectoryDetailsUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    const match = DIRECTORY_DETAILS_PATH.exec(url.pathname);
    if (!match) return null;
    assertMethod(request, HTTP_METHOD.GET);
    return jsonResponse({
      details: await this.details.getDetails(readApiRouteSegment(match)),
    });
  }
}
