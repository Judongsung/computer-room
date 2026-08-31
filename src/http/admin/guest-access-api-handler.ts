import { FILESYSTEM_PAGE_LIMIT } from "@/constants/filesystem/pagination";
import {
  GUEST_ACCESS_API_PATH,
  GUEST_ACCESS_API_PATHS,
} from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { API_ROUTE_PATTERN } from "@/constants/platform/http-route";
import {
  HTTP_METHOD,
  PRIVATE_NO_STORE_RESPONSE_HEADERS,
} from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import {
  assertMethod,
  readPageParameters,
  readRequiredJsonObject,
} from "@/http/filesystem/filesystem-request";
import {
  createExactApiRoutePattern,
  readApiRouteSegment,
} from "@/http/shared/api-route";
import { jsonResponse } from "@/http/shared/responses";
import type { GuestAccessUseCases } from "@/types/admin/guest-access-service";
import type { FeatureApiHandler } from "@/types/platform/http";

const GUEST_ACCESS_DIRECTORY_PATH = createExactApiRoutePattern(
  GUEST_ACCESS_API_PATHS.DIRECTORIES,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
);
const GUEST_ACCESS_ENTRY_PATH = createExactApiRoutePattern(
  GUEST_ACCESS_API_PATHS.ENTRIES,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
);

export class GuestAccessApiHandler implements FeatureApiHandler {
  constructor(private readonly guestAccess: GuestAccessUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === GUEST_ACCESS_API_PATH) {
      return this.handleSettings(request);
    }
    const directoryMatch = GUEST_ACCESS_DIRECTORY_PATH.exec(url.pathname);
    if (directoryMatch) {
      assertMethod(request, HTTP_METHOD.GET);
      const { offset, limit } = readPageParameters(
        url,
        FILESYSTEM_PAGE_LIMIT,
        HTTP_ERRORS.INVALID_FILESYSTEM_LIMIT,
      );
      return this.response(
        await this.guestAccess.listDirectory(
          readApiRouteSegment(directoryMatch),
          offset,
          limit,
        ),
      );
    }
    const entryMatch = GUEST_ACCESS_ENTRY_PATH.exec(url.pathname);
    if (entryMatch) {
      assertMethod(request, HTTP_METHOD.PUT);
      const body = await readRequiredJsonObject(request);
      if (typeof body.published !== "boolean") {
        throw new AppError(HTTP_ERRORS.INVALID_JSON);
      }
      return this.response(
        await this.guestAccess.setEntryPublished(
          readApiRouteSegment(entryMatch),
          body.published,
        ),
      );
    }
    return null;
  }

  private async handleSettings(request: Request): Promise<Response> {
    if (request.method === HTTP_METHOD.GET) {
      return this.response({ settings: await this.guestAccess.getSettings() });
    }
    if (request.method === HTTP_METHOD.PATCH) {
      const body = await readRequiredJsonObject(request);
      if (typeof body.enabled !== "boolean") {
        throw new AppError(HTTP_ERRORS.INVALID_JSON);
      }
      return this.response({
        settings: await this.guestAccess.updateSettings(body.enabled),
      });
    }
    throw new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
  }

  private response(value: unknown): Response {
    return jsonResponse(value, undefined, PRIVATE_NO_STORE_RESPONSE_HEADERS);
  }
}
