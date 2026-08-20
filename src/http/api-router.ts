import {
  API_PATHS,
  API_QUERY_PARAMETERS,
} from "../constants/api";
import {
  ACCESS_LOGOUT_PATH,
} from "../constants/auth";
import { FILE_ERRORS } from "../constants/errors/file";
import { HTTP_ERRORS } from "../constants/errors/http";
import { MAX_FILE_SIZE_BYTES } from "../constants/file";
import {
  FILE_DOWNLOAD_RESPONSE_HEADERS,
  HTTP_HEADERS,
  HTTP_METHOD,
  HTTP_STATUS,
} from "../constants/http";
import {
  DEFAULT_PAGE_LIMIT,
  DEFAULT_PAGE_OFFSET,
  MAX_PAGE_LIMIT,
} from "../constants/pagination";
import { AppError } from "../domain/errors";
import type { Identity, IdentityVerifier, SessionInfo } from "../types/auth";
import type { FileUseCases } from "../types/file-service";
import type { WidgetLayoutUseCases } from "../types/widget-service";
import { isWidgetLayoutCollection } from "../domain/widget-layout";
import { emptyResponse, errorResponse, jsonResponse } from "./responses";
import { readJsonBody } from "./request-body";

const FILE_DOWNLOAD_PATH = new RegExp(`^${API_PATHS.FILES}/([^/]+)/download$`);
const FILE_PATH = new RegExp(`^${API_PATHS.FILES}/([^/]+)$`);

export class ApiRouter {
  constructor(
    private readonly files: FileUseCases,
    private readonly widgets: WidgetLayoutUseCases,
    private readonly identities: IdentityVerifier,
  ) {}

  async handle(request: Request): Promise<Response> {
    try {
      const identity = await this.identities.verify(request);
      const url = new URL(request.url);
      this.assertSameOrigin(request, url);

      if (url.pathname === API_PATHS.SESSION) {
        return this.handleSession(request, identity);
      }

      if (url.pathname === API_PATHS.FILES) {
        return await this.handleFiles(request, url);
      }

      if (url.pathname === API_PATHS.WIDGETS) {
        return await this.handleWidgets(request);
      }

      const downloadMatch = FILE_DOWNLOAD_PATH.exec(url.pathname);
      if (downloadMatch) {
        return await this.handleDownload(request, downloadMatch[1] ?? "");
      }

      const fileMatch = FILE_PATH.exec(url.pathname);
      if (fileMatch) {
        return await this.handleFile(request, fileMatch[1] ?? "");
      }

      throw new AppError(HTTP_ERRORS.ROUTE_NOT_FOUND);
    } catch (error) {
      return errorResponse(error);
    }
  }

  private handleSession(request: Request, identity: Identity): Response {
    this.assertMethod(request, HTTP_METHOD.GET);
    const session = {
      email: identity.email,
      logoutUrl: ACCESS_LOGOUT_PATH,
      filePolicy: {
        maxUploadSizeBytes: MAX_FILE_SIZE_BYTES,
      },
    } satisfies SessionInfo;

    return jsonResponse(session);
  }

  private async handleFiles(request: Request, url: URL): Promise<Response> {
    if (request.method === HTTP_METHOD.GET) {
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

      return jsonResponse(await this.files.listFiles(offset, limit));
    }

    if (request.method === HTTP_METHOD.POST) {
      const name = url.searchParams.get(API_QUERY_PARAMETERS.FILE_NAME) ?? "";
      const declaredSize = parseFileSize(
        request.headers.get(HTTP_HEADERS.FILE_SIZE),
      );
      const file = await this.files.uploadFile({
        originalName: name,
        contentType: request.headers.get(HTTP_HEADERS.CONTENT_TYPE),
        declaredSize,
        body: request.body,
      });

      return jsonResponse({ file }, HTTP_STATUS.CREATED);
    }

    throw methodNotAllowed();
  }

  private async handleWidgets(request: Request): Promise<Response> {
    if (request.method === HTTP_METHOD.GET) {
      return jsonResponse({ items: await this.widgets.listWidgets() });
    }

    if (request.method === HTTP_METHOD.PUT) {
      const body = await readJsonBody(request);
      if (!isWidgetLayoutCollection(body)) {
        throw new AppError(HTTP_ERRORS.INVALID_JSON);
      }

      return jsonResponse({
        items: await this.widgets.replaceWidgets(body.items),
      });
    }

    throw methodNotAllowed();
  }

  private async handleDownload(request: Request, id: string): Promise<Response> {
    this.assertMethod(request, HTTP_METHOD.GET);
    const { metadata, object } = await this.files.downloadFile(id);

    return new Response(object.body, {
      headers: {
        ...FILE_DOWNLOAD_RESPONSE_HEADERS,
        [HTTP_HEADERS.CONTENT_DISPOSITION]: contentDisposition(
          metadata.originalName,
        ),
        [HTTP_HEADERS.CONTENT_LENGTH]: String(object.size),
        [HTTP_HEADERS.CONTENT_TYPE]: object.contentType,
        [HTTP_HEADERS.ETAG]: object.httpEtag,
      },
    });
  }

  private async handleFile(request: Request, id: string): Promise<Response> {
    this.assertMethod(request, HTTP_METHOD.DELETE);
    await this.files.deleteFile(id);
    return emptyResponse();
  }

  private assertMethod(request: Request, expected: string): void {
    if (request.method !== expected) {
      throw methodNotAllowed();
    }
  }

  private assertSameOrigin(request: Request, url: URL): void {
    if (request.method === HTTP_METHOD.GET) {
      return;
    }

    const origin = request.headers.get(HTTP_HEADERS.ORIGIN);
    if (origin !== url.origin) {
      throw new AppError(HTTP_ERRORS.CROSS_ORIGIN_REQUEST);
    }
  }
}

function parseIntegerParameter(value: string | null, fallback: number): number {
  if (value === null) {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    throw new AppError(HTTP_ERRORS.INVALID_QUERY);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new AppError(HTTP_ERRORS.INVALID_QUERY);
  }

  return parsed;
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

function methodNotAllowed(): AppError {
  return new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
}

function contentDisposition(fileName: string): string {
  const fallback = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
