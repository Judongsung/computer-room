import { API_PATH_SEGMENTS, FILESYSTEM_API_PATHS } from "@/constants/platform/api";
import { API_ROUTE_PATTERN } from "@/constants/platform/http-route";
import { HTTP_METHOD } from "@/constants/platform/http";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { AppError } from "@/domain/shared/errors";
import { assertMethod, readDesktopPlacement, readRequiredJsonObject } from "@/http/filesystem/filesystem-request";
import { createExactApiRoutePattern, readApiRouteSegment } from "@/http/shared/api-route";
import { jsonResponse } from "@/http/shared/responses";
import type { FeatureApiHandler } from "@/types/platform/http";
import type { FilesystemShortcutUseCases } from "@/types/filesystem/services/shortcut-service";

const TARGET_PATH = createExactApiRoutePattern(
  FILESYSTEM_API_PATHS.SHORTCUTS, API_ROUTE_PATTERN.CAPTURED_SEGMENT, API_PATH_SEGMENTS.TARGET,
);

export class FilesystemShortcutApiRoutes implements FeatureApiHandler {
  constructor(private readonly shortcuts: FilesystemShortcutUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === FILESYSTEM_API_PATHS.SHORTCUTS) {
      assertMethod(request, HTTP_METHOD.POST);
      const body = await readRequiredJsonObject(request);
      if (typeof body.targetEntryId !== "string" || typeof body.parentId !== "string" || typeof body.name !== "string") {
        throw new AppError(HTTP_ERRORS.INVALID_JSON);
      }
      const desktopPlacement = readDesktopPlacement(body);
      return jsonResponse({ entry: await this.shortcuts.createShortcut({
        targetEntryId: body.targetEntryId, parentId: body.parentId, name: body.name,
        ...(desktopPlacement === undefined ? {} : { desktopPlacement }),
      }) });
    }
    const match = TARGET_PATH.exec(url.pathname);
    if (!match) return null;
    assertMethod(request, HTTP_METHOD.GET);
    return jsonResponse({ entry: await this.shortcuts.resolveShortcut(readApiRouteSegment(match)) });
  }
}
