import { FILESYSTEM_PAGE_LIMIT } from "@/constants/filesystem/pagination";
import { GUEST_ERRORS } from "@/constants/guest/errors/guest";
import {
  GUEST_RATE_LIMIT,
  GUEST_RATE_LIMIT_CATEGORY,
} from "@/constants/guest/guest";
import {
  API_PATHS,
  API_PATH_SEGMENTS,
  GUEST_API_PATHS,
} from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import {
  GUEST_BINARY_RESPONSE_HEADERS,
  GUEST_FILE_CONTENT_RESPONSE_HEADERS,
  GUEST_METADATA_RESPONSE_HEADERS,
  HTTP_HEADERS,
  HTTP_METHOD,
} from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import {
  fileContentResponse,
  fileDownloadResponse,
  thumbnailResponse,
} from "@/http/filesystem/file-content-response";
import {
  assertMethod,
  readPageParameters,
  readRouteId,
} from "@/http/filesystem/filesystem-request";
import { errorResponse, jsonResponse } from "@/http/shared/responses";
import type {
  GuestRequestRateLimiter,
  GuestUseCases,
} from "@/types/guest/guest-service";
import type { PublicApiHandler } from "@/types/platform/http";

const DIRECTORY_PATH = new RegExp(`^${GUEST_API_PATHS.DIRECTORIES}/([^/]+)$`);
const FILE_ACTION_PATH = new RegExp(
  `^${GUEST_API_PATHS.FILES}/([^/]+)/(${API_PATH_SEGMENTS.DOWNLOAD}|${API_PATH_SEGMENTS.CONTENT}|${API_PATH_SEGMENTS.THUMBNAIL})$`,
);
const PROGRAM_DOCUMENT_PATH = new RegExp(
  `^${GUEST_API_PATHS.PROGRAM_DOCUMENTS}/([^/]+)$`,
);

export class GuestApiHandler implements PublicApiHandler {
  constructor(
    private readonly guest: GuestUseCases,
    private readonly rateLimiter: GuestRequestRateLimiter,
  ) {}

  matches(url: URL): boolean {
    return (
      url.pathname === API_PATHS.GUEST ||
      url.pathname.startsWith(`${API_PATHS.GUEST}/`)
    );
  }

  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname === GUEST_API_PATHS.SESSION) {
      return this.metadata(request, async () => {
        assertMethod(request, HTTP_METHOD.GET);
        return jsonResponse(
          await this.guest.getSession(),
          undefined,
          GUEST_METADATA_RESPONSE_HEADERS,
        );
      });
    }

    const directoryMatch = DIRECTORY_PATH.exec(url.pathname);
    if (directoryMatch) {
      return this.metadata(request, async () => {
        assertMethod(request, HTTP_METHOD.GET);
        const { offset, limit } = readPageParameters(
          url,
          FILESYSTEM_PAGE_LIMIT,
          HTTP_ERRORS.INVALID_FILESYSTEM_LIMIT,
        );
        return jsonResponse(
          await this.guest.listDirectory(
            readRouteId(directoryMatch),
            offset,
            limit,
          ),
          undefined,
          GUEST_METADATA_RESPONSE_HEADERS,
        );
      });
    }

    const fileMatch = FILE_ACTION_PATH.exec(url.pathname);
    if (fileMatch) {
      return this.binary(request, () =>
        this.handleFile(request, readRouteId(fileMatch), fileMatch[2] ?? ""),
      );
    }

    const programMatch = PROGRAM_DOCUMENT_PATH.exec(url.pathname);
    if (programMatch) {
      return this.metadata(request, async () => {
        assertMethod(request, HTTP_METHOD.GET);
        return jsonResponse(
          await this.guest.getProgramDocument(readRouteId(programMatch)),
          undefined,
          GUEST_METADATA_RESPONSE_HEADERS,
        );
      });
    }

    return errorResponse(
      new AppError(HTTP_ERRORS.ROUTE_NOT_FOUND),
      GUEST_METADATA_RESPONSE_HEADERS,
    );
  }

  private handleFile(
    request: Request,
    id: string,
    action: string,
  ): Promise<Response> {
    if (action === API_PATH_SEGMENTS.DOWNLOAD) {
      return fileDownloadResponse(
        this.guest,
        request,
        id,
        GUEST_BINARY_RESPONSE_HEADERS,
      );
    }
    if (action === API_PATH_SEGMENTS.CONTENT) {
      return fileContentResponse(
        this.guest,
        request,
        id,
        GUEST_FILE_CONTENT_RESPONSE_HEADERS,
      );
    }
    return thumbnailResponse(
      this.guest,
      request,
      id,
      GUEST_BINARY_RESPONSE_HEADERS,
    );
  }

  private async metadata(
    request: Request,
    action: () => Promise<Response>,
  ): Promise<Response> {
    try {
      return await this.rateLimited(
        request,
        GUEST_RATE_LIMIT_CATEGORY.METADATA,
        action,
      );
    } catch (error) {
      return errorResponse(error, GUEST_METADATA_RESPONSE_HEADERS);
    }
  }

  private async binary(
    request: Request,
    action: () => Promise<Response>,
  ): Promise<Response> {
    try {
      return await this.rateLimited(
        request,
        GUEST_RATE_LIMIT_CATEGORY.BINARY,
        action,
      );
    } catch (error) {
      return errorResponse(error, GUEST_BINARY_RESPONSE_HEADERS);
    }
  }

  private async rateLimited(
    request: Request,
    category:
      (typeof GUEST_RATE_LIMIT_CATEGORY)[keyof typeof GUEST_RATE_LIMIT_CATEGORY],
    action: () => Promise<Response>,
  ): Promise<Response> {
    if (await this.rateLimiter.allow(request, category)) return action();
    const responseHeaders =
      category === GUEST_RATE_LIMIT_CATEGORY.BINARY
        ? GUEST_BINARY_RESPONSE_HEADERS
        : GUEST_METADATA_RESPONSE_HEADERS;
    return jsonResponse(
      {
        error: {
          code: GUEST_ERRORS.RATE_LIMITED.code,
          message: GUEST_ERRORS.RATE_LIMITED.message,
        },
      },
      GUEST_ERRORS.RATE_LIMITED.status,
      {
        ...responseHeaders,
        [HTTP_HEADERS.RETRY_AFTER]: String(
          GUEST_RATE_LIMIT.RETRY_AFTER_SECONDS,
        ),
      },
    );
  }
}
