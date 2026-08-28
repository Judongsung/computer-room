import { FILESYSTEM_PAGE_LIMIT } from "@/constants/filesystem/pagination";
import {
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
  FILESYSTEM_API_PATHS,
} from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { requireFilesystemDirectorySort } from "@/domain/filesystem/filesystem-sort";
import { AppError } from "@/domain/shared/errors";
import type { FilesystemUseCases } from "@/types/filesystem/filesystem-service";
import type { FeatureApiHandler } from "@/types/platform/http";
import {
  assertMethod,
  isRecord,
  methodNotAllowed,
  readDesktopPlacement,
  readIdArray,
  readOptionalString,
  readPageParameters,
  readRequiredJsonObject,
  readRouteId,
} from "@/http/filesystem/filesystem-request";
import { readJsonBody } from "@/http/shared/request-body";
import { jsonResponse } from "@/http/shared/responses";

const ENTRY_PATH = new RegExp(`^${FILESYSTEM_API_PATHS.ENTRIES}/([^/]+)$`);
const MOVE_PATH = new RegExp(
  `^${FILESYSTEM_API_PATHS.ENTRIES}/([^/]+)/${API_PATH_SEGMENTS.MOVE}$`,
);
const DIRECTORY_SORT_PATH = new RegExp(
  `^${FILESYSTEM_API_PATHS.DIRECTORIES}/([^/]+)/${API_PATH_SEGMENTS.SORT}$`,
);

export class FilesystemEntryApiRoutes implements FeatureApiHandler {
  constructor(private readonly filesystem: FilesystemUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === FILESYSTEM_API_PATHS.ENTRIES) {
      return this.listEntries(request, url);
    }
    if (url.pathname === FILESYSTEM_API_PATHS.DIRECTORIES) {
      return this.createDirectory(request);
    }
    if (url.pathname === FILESYSTEM_API_PATHS.BATCH_MOVE) {
      return this.moveEntries(request);
    }
    if (url.pathname === FILESYSTEM_API_PATHS.BATCH_TRASH) {
      return this.trashEntries(request);
    }

    const sortMatch = DIRECTORY_SORT_PATH.exec(url.pathname);
    if (sortMatch) {
      return this.updateDirectorySort(request, readRouteId(sortMatch));
    }

    const moveMatch = MOVE_PATH.exec(url.pathname);
    if (moveMatch) {
      return this.moveEntry(request, readRouteId(moveMatch));
    }

    const entryMatch = ENTRY_PATH.exec(url.pathname);
    if (entryMatch) {
      return this.updateOrTrashEntry(request, readRouteId(entryMatch));
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
      await this.filesystem.listDirectory(
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
    const directory = await this.filesystem.createDirectory(
      parentId ?? null,
      body.name,
      desktopPlacement,
    );
    return jsonResponse({ directory }, HTTP_STATUS.CREATED);
  }

  private async updateOrTrashEntry(
    request: Request,
    id: string,
  ): Promise<Response> {
    if (request.method === HTTP_METHOD.DELETE) {
      return jsonResponse(await this.filesystem.trashEntry(id));
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
        entry: await this.filesystem.updateEntry(id, {
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
      entry: await this.filesystem.moveEntry(id, {
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
      await this.filesystem.moveEntries(readIdArray(body.entryIds), {
        parentId: body.parentId,
        ...(desktopPlacement === undefined ? {} : { desktopPlacement }),
      }),
    );
  }

  private async trashEntries(request: Request): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const body = await readRequiredJsonObject(request);
    return jsonResponse(
      await this.filesystem.trashEntries(readIdArray(body.entryIds)),
    );
  }

  private async updateDirectorySort(
    request: Request,
    id: string,
  ): Promise<Response> {
    assertMethod(request, HTTP_METHOD.PUT);
    const body = await readRequiredJsonObject(request);
    return jsonResponse({
      sort: await this.filesystem.updateDirectorySort(
        id,
        requireFilesystemDirectorySort(body),
      ),
    });
  }
}
