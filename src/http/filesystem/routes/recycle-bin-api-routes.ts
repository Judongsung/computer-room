import { FILESYSTEM_PAGE_LIMIT } from "@/constants/filesystem/pagination";
import {
  API_PATH_SEGMENTS,
  FILESYSTEM_API_PATHS,
} from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { HTTP_METHOD } from "@/constants/platform/http";
import type { RecycleBinUseCases } from "@/types/filesystem/filesystem-service";
import type { FeatureApiHandler } from "@/types/platform/http";
import {
  assertMethod,
  methodNotAllowed,
  readDesktopPlacement,
  readIdArray,
  readOptionalJsonObject,
  readOptionalString,
  readPageParameters,
  readRequiredJsonObject,
  readRouteId,
} from "@/http/filesystem/filesystem-request";
import { emptyResponse, jsonResponse } from "@/http/shared/responses";

const TRASH_ENTRY_PATH = new RegExp(
  `^${FILESYSTEM_API_PATHS.TRASH}/([^/]+)$`,
);
const RESTORE_PATH = new RegExp(
  `^${FILESYSTEM_API_PATHS.TRASH}/([^/]+)/${API_PATH_SEGMENTS.RESTORE}$`,
);

export class RecycleBinApiRoutes implements FeatureApiHandler {
  constructor(private readonly recycleBin: RecycleBinUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === FILESYSTEM_API_PATHS.TRASH) {
      return this.listOrEmpty(request, url);
    }
    if (url.pathname === FILESYSTEM_API_PATHS.BATCH_RESTORE) {
      return this.restoreEntries(request);
    }
    if (url.pathname === FILESYSTEM_API_PATHS.BATCH_DELETE) {
      return this.deleteEntries(request);
    }

    const restoreMatch = RESTORE_PATH.exec(url.pathname);
    if (restoreMatch) {
      return this.restoreEntry(request, readRouteId(restoreMatch));
    }

    const trashEntryMatch = TRASH_ENTRY_PATH.exec(url.pathname);
    if (trashEntryMatch) {
      assertMethod(request, HTTP_METHOD.DELETE);
      await this.recycleBin.permanentlyDeleteEntry(
        readRouteId(trashEntryMatch),
      );
      return emptyResponse();
    }

    return null;
  }

  private async listOrEmpty(request: Request, url: URL): Promise<Response> {
    if (request.method === HTTP_METHOD.GET) {
      const { offset, limit } = readPageParameters(
        url,
        FILESYSTEM_PAGE_LIMIT,
        HTTP_ERRORS.INVALID_FILESYSTEM_LIMIT,
      );
      return jsonResponse(await this.recycleBin.listTrash(offset, limit));
    }
    if (request.method === HTTP_METHOD.DELETE) {
      await this.recycleBin.emptyTrash();
      return emptyResponse();
    }
    throw methodNotAllowed();
  }

  private async restoreEntry(request: Request, id: string): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const body = await readOptionalJsonObject(request);
    const parentId = readOptionalString(body.parentId);
    const desktopPlacement = readDesktopPlacement(body);
    return jsonResponse({
      entry: await this.recycleBin.restoreEntry(id, {
        ...(parentId === undefined ? {} : { parentId }),
        ...(desktopPlacement === undefined ? {} : { desktopPlacement }),
      }),
    });
  }

  private async restoreEntries(request: Request): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const body = await readRequiredJsonObject(request);
    const parentId = readOptionalString(body.parentId);
    const desktopPlacement = readDesktopPlacement(body);
    return jsonResponse(
      await this.recycleBin.restoreEntries(readIdArray(body.entryIds), {
        ...(parentId === undefined ? {} : { parentId }),
        ...(desktopPlacement === undefined ? {} : { desktopPlacement }),
      }),
    );
  }

  private async deleteEntries(request: Request): Promise<Response> {
    assertMethod(request, HTTP_METHOD.POST);
    const body = await readRequiredJsonObject(request);
    return jsonResponse(
      await this.recycleBin.permanentlyDeleteEntries(
        readIdArray(body.entryIds),
      ),
    );
  }
}
