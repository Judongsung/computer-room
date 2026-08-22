import {
  API_PATHS,
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
} from "../constants/api";
import { FILE_ERRORS } from "../constants/errors/file";
import { HTTP_ERRORS } from "../constants/errors/http";
import {
  CONTENT_DISPOSITION_MODE,
  FILE_CONTENT_RESPONSE_HEADERS,
  FILE_DOWNLOAD_RESPONSE_HEADERS,
  HTTP_HEADERS,
  HTTP_METHOD,
  HTTP_RANGE_UNIT,
  HTTP_STATUS,
} from "../constants/http";
import {
  DEFAULT_PAGE_LIMIT,
  DEFAULT_PAGE_OFFSET,
  MAX_PAGE_LIMIT,
} from "../constants/pagination";
import { AppError } from "../domain/errors";
import { FileRangeNotSatisfiableError } from "../domain/file-content-error";
import type { FileUseCases } from "../types/file-service";
import type {
  FilesystemUseCases,
  RecycleBinUseCases,
} from "../types/filesystem-service";
import type { FeatureApiHandler } from "../types/http";
import { parseIntegerParameter } from "./query-parameters";
import { parseRangeHeader } from "./byte-range";
import { readJsonBody } from "./request-body";
import { emptyResponse, jsonResponse } from "./responses";

const FILE_DOWNLOAD_PATH = new RegExp(`^${API_PATHS.FILES}/([^/]+)/download$`);
const FILE_CONTENT_PATH = new RegExp(
  `^${API_PATHS.FILES}/([^/]+)/${API_PATH_SEGMENTS.CONTENT}$`,
);
const FILE_PATH = new RegExp(`^${API_PATHS.FILES}/([^/]+)$`);
const FILESYSTEM_ENTRIES_PATH = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.ENTRIES}`;
const FILESYSTEM_DIRECTORIES_PATH = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.DIRECTORIES}`;
const FILESYSTEM_TRASH_PATH = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.TRASH}`;
const FILESYSTEM_ENTRY_PATH = new RegExp(`^${FILESYSTEM_ENTRIES_PATH}/([^/]+)$`);
const FILESYSTEM_TRASH_ENTRY_PATH = new RegExp(`^${FILESYSTEM_TRASH_PATH}/([^/]+)$`);
const FILESYSTEM_RESTORE_PATH = new RegExp(
  `^${FILESYSTEM_TRASH_PATH}/([^/]+)/${API_PATH_SEGMENTS.RESTORE}$`,
);

export class FileApiHandler implements FeatureApiHandler {
  constructor(
    private readonly files: FileUseCases,
    private readonly filesystem: FilesystemUseCases,
    private readonly recycleBin: RecycleBinUseCases,
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

    const restoreMatch = FILESYSTEM_RESTORE_PATH.exec(url.pathname);
    if (restoreMatch) {
      assertMethod(request, HTTP_METHOD.POST);
      return jsonResponse({
        entry: await this.recycleBin.restoreEntry(readId(restoreMatch)),
      });
    }
    const trashEntryMatch = FILESYSTEM_TRASH_ENTRY_PATH.exec(url.pathname);
    if (trashEntryMatch) {
      assertMethod(request, HTTP_METHOD.DELETE);
      await this.recycleBin.permanentlyDeleteEntry(readId(trashEntryMatch));
      return emptyResponse();
    }
    const downloadMatch = FILE_DOWNLOAD_PATH.exec(url.pathname);
    if (downloadMatch) {
      return this.handleDownload(request, readId(downloadMatch));
    }
    const contentMatch = FILE_CONTENT_PATH.exec(url.pathname);
    if (contentMatch) {
      return this.handleContent(request, readId(contentMatch));
    }
    const legacyFileMatch = FILE_PATH.exec(url.pathname);
    if (legacyFileMatch) {
      assertMethod(request, HTTP_METHOD.DELETE);
      await this.filesystem.trashEntry(readId(legacyFileMatch));
      return emptyResponse();
    }
    const entryMatch = FILESYSTEM_ENTRY_PATH.exec(url.pathname);
    if (entryMatch) {
      return this.handleEntry(request, readId(entryMatch));
    }
    return null;
  }

  private async handleFiles(request: Request, url: URL): Promise<Response> {
    if (request.method === HTTP_METHOD.GET) {
      const { offset, limit } = pageParameters(url);
      return jsonResponse(await this.files.listFiles(offset, limit));
    }
    if (request.method === HTTP_METHOD.POST) {
      const name = url.searchParams.get(API_QUERY_PARAMETERS.FILE_NAME) ?? "";
      const declaredSize = parseFileSize(
        request.headers.get(HTTP_HEADERS.FILE_SIZE),
      );
      const file = await this.files.uploadFile({
        parentId: url.searchParams.get(API_QUERY_PARAMETERS.PARENT_ID),
        originalName: name,
        contentType: request.headers.get(HTTP_HEADERS.CONTENT_TYPE),
        declaredSize,
        body: request.body,
      });
      return jsonResponse({ file }, HTTP_STATUS.CREATED);
    }
    throw methodNotAllowed();
  }

  private async handleEntries(request: Request, url: URL): Promise<Response> {
    assertMethod(request, HTTP_METHOD.GET);
    const { offset, limit } = pageParameters(url);
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
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.name !== "string") {
      throw new AppError(HTTP_ERRORS.INVALID_JSON);
    }
    const parentId = readOptionalString(body.parentId);
    const directory = await this.filesystem.createDirectory(
      parentId ?? null,
      body.name,
    );
    return jsonResponse({ directory }, HTTP_STATUS.CREATED);
  }

  private async handleEntry(request: Request, id: string): Promise<Response> {
    if (request.method === HTTP_METHOD.DELETE) {
      await this.filesystem.trashEntry(id);
      return emptyResponse();
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
      const { offset, limit } = pageParameters(url);
      return jsonResponse(await this.recycleBin.listTrash(offset, limit));
    }
    if (request.method === HTTP_METHOD.DELETE) {
      await this.recycleBin.emptyTrash();
      return emptyResponse();
    }
    throw methodNotAllowed();
  }

  private async handleDownload(
    request: Request,
    id: string,
  ): Promise<Response> {
    assertMethod(request, HTTP_METHOD.GET);
    const { entry, object } = await this.files.downloadFile(id);
    return new Response(object.body, {
      headers: {
        ...FILE_DOWNLOAD_RESPONSE_HEADERS,
        [HTTP_HEADERS.CONTENT_DISPOSITION]: contentDisposition(
          entry.name,
          CONTENT_DISPOSITION_MODE.ATTACHMENT,
        ),
        [HTTP_HEADERS.CONTENT_LENGTH]: String(object.size),
        [HTTP_HEADERS.CONTENT_TYPE]: object.contentType,
        [HTTP_HEADERS.ETAG]: object.httpEtag,
      },
    });
  }

  private async handleContent(
    request: Request,
    id: string,
  ): Promise<Response> {
    assertMethod(request, HTTP_METHOD.GET);
    try {
      const { entry, object, range } = await this.files.streamFile(
        id,
        parseRangeHeader(request.headers.get(HTTP_HEADERS.RANGE)),
      );
      const headers = new Headers(FILE_CONTENT_RESPONSE_HEADERS);
      headers.set(
        HTTP_HEADERS.CONTENT_DISPOSITION,
        contentDisposition(entry.name, CONTENT_DISPOSITION_MODE.INLINE),
      );
      headers.set(HTTP_HEADERS.CONTENT_LENGTH, String(range?.length ?? object.size));
      headers.set(HTTP_HEADERS.CONTENT_TYPE, object.contentType);
      headers.set(HTTP_HEADERS.ETAG, object.httpEtag);
      if (range) {
        const lastByte = range.offset + range.length - 1;
        headers.set(
          HTTP_HEADERS.CONTENT_RANGE,
          `${HTTP_RANGE_UNIT} ${range.offset}-${lastByte}/${object.size}`,
        );
      }
      return new Response(object.body, {
        status: range ? HTTP_STATUS.PARTIAL_CONTENT : HTTP_STATUS.OK,
        headers,
      });
    } catch (error) {
      if (error instanceof FileRangeNotSatisfiableError) {
        return jsonResponse(
          { error: { code: error.code, message: error.message } },
          error.status,
          {
            ...FILE_CONTENT_RESPONSE_HEADERS,
            [HTTP_HEADERS.CONTENT_RANGE]: `${HTTP_RANGE_UNIT} */${error.totalSize}`,
          },
        );
      }
      throw error;
    }
  }
}

function pageParameters(url: URL): { offset: number; limit: number } {
  const offset = parseIntegerParameter(
    url.searchParams.get(API_QUERY_PARAMETERS.OFFSET),
    DEFAULT_PAGE_OFFSET,
  );
  const limit = parseIntegerParameter(
    url.searchParams.get(API_QUERY_PARAMETERS.LIMIT),
    DEFAULT_PAGE_LIMIT,
  );
  if (limit < 1 || limit > MAX_PAGE_LIMIT) {
    throw new AppError(HTTP_ERRORS.INVALID_LIMIT);
  }
  return { offset, limit };
}

function parseFileSize(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new AppError(FILE_ERRORS.INVALID_FILE_SIZE);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new AppError(FILE_ERRORS.INVALID_FILE_SIZE);
  }
  return parsed;
}

function assertMethod(request: Request, expected: string): void {
  if (request.method !== expected) {
    throw methodNotAllowed();
  }
}

function methodNotAllowed(): AppError {
  return new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
}

function readId(match: RegExpExecArray): string {
  return decodeURIComponent(match[1] ?? "");
}

function readOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AppError(HTTP_ERRORS.INVALID_JSON);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function contentDisposition(fileName: string, mode: string): string {
  const fallback = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${mode}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
