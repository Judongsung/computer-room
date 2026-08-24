import {
  API_PATHS,
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
  FILESYSTEM_API_PATHS,
} from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import {
  CONTENT_DISPOSITION_MODE,
  FILE_CONTENT_RESPONSE_HEADERS,
  FILE_DOWNLOAD_RESPONSE_HEADERS,
  HTTP_HEADERS,
  HTTP_METHOD,
  HTTP_RANGE_UNIT,
  HTTP_STATUS,
  THUMBNAIL_RESPONSE_HEADERS,
} from "@/constants/platform/http";
import {
  FILESYSTEM_PAGE_LIMIT,
  LEGACY_FILE_PAGE_LIMIT,
} from "@/constants/filesystem/pagination";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { AppError } from "@/domain/shared/errors";
import { requireFilesystemDirectorySort } from "@/domain/filesystem/filesystem-sort";
import { FileRangeNotSatisfiableError } from "@/domain/filesystem/file-content-error";
import type { FileUseCases } from "@/types/filesystem/file-service";
import type {
  FilesystemUseCases,
  FilesystemDownloadManifestUseCases,
  RecycleBinUseCases,
} from "@/types/filesystem/filesystem-service";
import type { FeatureApiHandler } from "@/types/platform/http";
import type { ThumbnailUseCases } from "@/types/filesystem/thumbnail";
import { parseRangeHeader } from "@/http/filesystem/byte-range";
import { readJsonBody } from "@/http/shared/request-body";
import { emptyResponse, jsonResponse } from "@/http/shared/responses";
import { readDeclaredFileSize } from "@/http/filesystem/file-upload-request";
import {
  assertMethod,
  contentDisposition,
  isRecord,
  methodNotAllowed,
  readDesktopPlacement,
  readDesktopPlacementFromQuery,
  readIdArray,
  readOptionalJsonObject,
  readOptionalString,
  readPageParameters,
  readRequiredJsonObject,
  readRouteId,
} from "@/http/filesystem/filesystem-request";
import {
  fileContentResponse,
  fileDownloadResponse,
  thumbnailResponse,
} from "@/http/filesystem/file-content-response";

const FILE_DOWNLOAD_PATH = new RegExp(`^${API_PATHS.FILES}/([^/]+)/download$`);
const FILE_CONTENT_PATH = new RegExp(
  `^${API_PATHS.FILES}/([^/]+)/${API_PATH_SEGMENTS.CONTENT}$`,
);
const FILE_THUMBNAIL_PATH = new RegExp(
  `^${API_PATHS.FILES}/([^/]+)/${API_PATH_SEGMENTS.THUMBNAIL}$`,
);
const FILE_PATH = new RegExp(`^${API_PATHS.FILES}/([^/]+)$`);
const {
  ENTRIES: FILESYSTEM_ENTRIES_PATH,
  DIRECTORIES: FILESYSTEM_DIRECTORIES_PATH,
  TRASH: FILESYSTEM_TRASH_PATH,
  BATCH_MOVE: FILESYSTEM_BATCH_MOVE_PATH,
  BATCH_TRASH: FILESYSTEM_BATCH_TRASH_PATH,
  BATCH_RESTORE: FILESYSTEM_BATCH_RESTORE_PATH,
  BATCH_DELETE: FILESYSTEM_BATCH_DELETE_PATH,
  DOWNLOAD_MANIFEST: FILESYSTEM_DOWNLOAD_MANIFEST_PATH,
} = FILESYSTEM_API_PATHS;
const FILESYSTEM_ENTRY_PATH = new RegExp(`^${FILESYSTEM_ENTRIES_PATH}/([^/]+)$`);
const FILESYSTEM_MOVE_PATH = new RegExp(
  `^${FILESYSTEM_ENTRIES_PATH}/([^/]+)/${API_PATH_SEGMENTS.MOVE}$`,
);
const FILESYSTEM_TRASH_ENTRY_PATH = new RegExp(`^${FILESYSTEM_TRASH_PATH}/([^/]+)$`);
const FILESYSTEM_RESTORE_PATH = new RegExp(
  `^${FILESYSTEM_TRASH_PATH}/([^/]+)/${API_PATH_SEGMENTS.RESTORE}$`,
);
const FILESYSTEM_DIRECTORY_SORT_PATH = new RegExp(
  `^${FILESYSTEM_DIRECTORIES_PATH}/([^/]+)/${API_PATH_SEGMENTS.SORT}$`,
);

export class FileApiHandler implements FeatureApiHandler {
  constructor(
    private readonly files: FileUseCases,
    private readonly thumbnails: ThumbnailUseCases,
    private readonly filesystem: FilesystemUseCases,
    private readonly recycleBin: RecycleBinUseCases,
    private readonly downloadManifests: FilesystemDownloadManifestUseCases,
  ) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === API_PATHS.FILES) {
      return this.handleFiles(request, url);
    }
    if (url.pathname === FILESYSTEM_ENTRIES_PATH) {
      return this.handleEntries(request, url);
    }
    if (url.pathname === FILESYSTEM_DIRECTORIES_PATH) {
      return this.handleDirectories(request);
    }
    if (url.pathname === FILESYSTEM_TRASH_PATH) {
      return this.handleTrash(request, url);
    }
    if (url.pathname === FILESYSTEM_BATCH_MOVE_PATH) {
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
    if (url.pathname === FILESYSTEM_BATCH_TRASH_PATH) {
      assertMethod(request, HTTP_METHOD.POST);
      const body = await readRequiredJsonObject(request);
      return jsonResponse(
        await this.filesystem.trashEntries(readIdArray(body.entryIds)),
      );
    }
    if (url.pathname === FILESYSTEM_BATCH_RESTORE_PATH) {
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
    if (url.pathname === FILESYSTEM_BATCH_DELETE_PATH) {
      assertMethod(request, HTTP_METHOD.POST);
      const body = await readRequiredJsonObject(request);
      return jsonResponse(
        await this.recycleBin.permanentlyDeleteEntries(
          readIdArray(body.entryIds),
        ),
      );
    }
    if (url.pathname === FILESYSTEM_DOWNLOAD_MANIFEST_PATH) {
      assertMethod(request, HTTP_METHOD.POST);
      const body = await readRequiredJsonObject(request);
      const manifest = await this.downloadManifests.createManifest(
        readIdArray(body.entryIds),
      );
      return jsonResponse({
        ...manifest,
        entries: manifest.entries.map((entry) =>
          entry.kind === FILESYSTEM_ENTRY_KIND.FILE
            ? {
                ...entry,
                downloadUrl: `${API_PATHS.FILES}/${encodeURIComponent(entry.id)}/download`,
              }
            : entry,
        ),
      });
    }

    const directorySortMatch = FILESYSTEM_DIRECTORY_SORT_PATH.exec(
      url.pathname,
    );
    if (directorySortMatch) {
      assertMethod(request, HTTP_METHOD.PUT);
      const body = await readRequiredJsonObject(request);
      return jsonResponse({
        sort: await this.filesystem.updateDirectorySort(
          readRouteId(directorySortMatch),
          requireFilesystemDirectorySort(body),
        ),
      });
    }

    const restoreMatch = FILESYSTEM_RESTORE_PATH.exec(url.pathname);
    if (restoreMatch) {
      assertMethod(request, HTTP_METHOD.POST);
      const body = await readOptionalJsonObject(request);
      const parentId = readOptionalString(body.parentId);
      const desktopPlacement = readDesktopPlacement(body);
      return jsonResponse({
        entry: await this.recycleBin.restoreEntry(readRouteId(restoreMatch), {
          ...(parentId === undefined ? {} : { parentId }),
          ...(desktopPlacement === undefined ? {} : { desktopPlacement }),
        }),
      });
    }
    const trashEntryMatch = FILESYSTEM_TRASH_ENTRY_PATH.exec(url.pathname);
    if (trashEntryMatch) {
      assertMethod(request, HTTP_METHOD.DELETE);
      await this.recycleBin.permanentlyDeleteEntry(readRouteId(trashEntryMatch));
      return emptyResponse();
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
      return thumbnailResponse(this.thumbnails, request, readRouteId(thumbnailMatch));
    }
    const legacyFileMatch = FILE_PATH.exec(url.pathname);
    if (legacyFileMatch) {
      assertMethod(request, HTTP_METHOD.DELETE);
      await this.filesystem.trashEntry(readRouteId(legacyFileMatch));
      return emptyResponse();
    }
    const entryMatch = FILESYSTEM_ENTRY_PATH.exec(url.pathname);
    if (entryMatch) {
      return this.handleEntry(request, readRouteId(entryMatch));
    }
    const moveMatch = FILESYSTEM_MOVE_PATH.exec(url.pathname);
    if (moveMatch) {
      assertMethod(request, HTTP_METHOD.POST);
      const body = await readRequiredJsonObject(request);
      if (typeof body.parentId !== "string") {
        throw new AppError(HTTP_ERRORS.INVALID_JSON);
      }
      const desktopPlacement = readDesktopPlacement(body);
      return jsonResponse({
        entry: await this.filesystem.moveEntry(readRouteId(moveMatch), {
          parentId: body.parentId,
          ...(desktopPlacement === undefined ? {} : { desktopPlacement }),
        }),
      });
    }
    return null;
  }

  private async handleFiles(request: Request, url: URL): Promise<Response> {
    if (request.method === HTTP_METHOD.GET) {
      const { offset, limit } = readPageParameters(
        url,
        LEGACY_FILE_PAGE_LIMIT,
        HTTP_ERRORS.INVALID_LIMIT,
      );
      return jsonResponse(await this.files.listFiles(offset, limit));
    }
    if (request.method === HTTP_METHOD.POST) {
      const name = url.searchParams.get(API_QUERY_PARAMETERS.FILE_NAME) ?? "";
      const declaredSize = readDeclaredFileSize(request);
      const file = await this.files.uploadFile({
        parentId: url.searchParams.get(API_QUERY_PARAMETERS.PARENT_ID),
        originalName: name,
        contentType: request.headers.get(HTTP_HEADERS.CONTENT_TYPE),
        declaredSize,
        body: request.body,
        ...readDesktopPlacementFromQuery(url),
      });
      return jsonResponse({ file }, HTTP_STATUS.CREATED);
    }
    throw methodNotAllowed();
  }

  private async handleEntries(request: Request, url: URL): Promise<Response> {
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

  private async handleDirectories(request: Request): Promise<Response> {
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

  private async handleEntry(request: Request, id: string): Promise<Response> {
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

  private async handleTrash(request: Request, url: URL): Promise<Response> {
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

}
