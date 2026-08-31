import {
  API_PATH_SEGMENTS,
  FILESYSTEM_API_PATHS,
} from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { API_ROUTE_PATTERN } from "@/constants/platform/http-route";
import { HTTP_METHOD } from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import type { FilesystemEntryUseCases } from "@/types/filesystem/services/entry-service";
import type { FilesystemTrashUseCases } from "@/types/filesystem/services/trash-service";
import type { FeatureApiHandler } from "@/types/platform/http";
import {
  assertMethod,
  isRecord,
  methodNotAllowed,
  readDesktopPlacement,
  readIdArray,
  readOptionalString,
  readRequiredJsonObject,
} from "@/http/filesystem/filesystem-request";
import {
  createExactApiRoutePattern,
  readApiRouteSegment,
} from "@/http/shared/api-route";
import { readJsonBody } from "@/http/shared/request-body";
import { jsonResponse } from "@/http/shared/responses";

const ENTRY_PATH = createExactApiRoutePattern(
  FILESYSTEM_API_PATHS.ENTRIES,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
);
const MOVE_PATH = createExactApiRoutePattern(
  FILESYSTEM_API_PATHS.ENTRIES,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.MOVE,
);

export class FilesystemEntryApiRoutes implements FeatureApiHandler {
  constructor(
    private readonly entries: FilesystemEntryUseCases,
    private readonly trash: FilesystemTrashUseCases,
  ) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === FILESYSTEM_API_PATHS.BATCH_MOVE) {
      return this.moveEntries(request);
    }
    if (url.pathname === FILESYSTEM_API_PATHS.BATCH_TRASH) {
      return this.trashEntries(request);
    }

    const moveMatch = MOVE_PATH.exec(url.pathname);
    if (moveMatch) {
      return this.moveEntry(request, readApiRouteSegment(moveMatch));
    }

    const entryMatch = ENTRY_PATH.exec(url.pathname);
    if (entryMatch) {
      return this.updateOrTrashEntry(request, readApiRouteSegment(entryMatch));
    }

    return null;
  }

  private async updateOrTrashEntry(
    request: Request,
    id: string,
  ): Promise<Response> {
    if (request.method === HTTP_METHOD.DELETE) {
      return jsonResponse(await this.trash.trashEntry(id));
    }
    if (request.method === HTTP_METHOD.PATCH) {
      const body = await readJsonBody(request);
      if (!isRecord(body)) {
        throw new AppError(HTTP_ERRORS.INVALID_JSON);
      }
      const name = readOptionalString(body.name);
      const parentId = readOptionalString(body.parentId);
      if (name === undefined && parentId === undefined) {
        throw new AppError(HTTP_ERRORS.INVALID_JSON);
      }
      return jsonResponse({
        entry: await this.entries.updateEntry(id, {
          ...(name === undefined ? {} : { name }),
          ...(parentId === undefined ? {} : { parentId }),
        }),
      });
    }
    throw methodNotAllowed();
  }

  private async moveEntry(request: Request, id: string): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const body = await readRequiredJsonObject(request);
    if (typeof body.parentId !== "string") {
      throw new AppError(HTTP_ERRORS.INVALID_JSON);
    }
    const desktopPlacement = readDesktopPlacement(body);
    return jsonResponse({
      entry: await this.entries.moveEntry(id, {
        parentId: body.parentId,
        ...(desktopPlacement === undefined ? {} : { desktopPlacement }),
      }),
    });
  }

  private async moveEntries(request: Request): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const body = await readRequiredJsonObject(request);
    if (typeof body.parentId !== "string") {
      throw new AppError(HTTP_ERRORS.INVALID_JSON);
    }
    const desktopPlacement = readDesktopPlacement(body);
    return jsonResponse(
      await this.entries.moveEntries(readIdArray(body.entryIds), {
        parentId: body.parentId,
        ...(desktopPlacement === undefined ? {} : { desktopPlacement }),
      }),
    );
  }

  private async trashEntries(request: Request): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const body = await readRequiredJsonObject(request);
    return jsonResponse(
      await this.trash.trashEntries(readIdArray(body.entryIds)),
    );
  }
}
