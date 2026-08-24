import { API_PATHS, NOVELAI_IMAGE_UPLOAD_API_PATH } from "@/constants/platform/api";
import { ACCESS_LOGOUT_PATH } from "@/constants/platform/auth";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { MAX_FILE_SIZE_BYTES } from "@/constants/filesystem/file";
import { HTTP_HEADERS, HTTP_METHOD } from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import type {
  Identity,
  IdentityVerifier,
  RequestVerifier,
  SessionInfo,
} from "@/types/platform/auth";
import type { FeatureApiHandler } from "@/types/platform/http";
import { errorResponse, jsonResponse } from "@/http/shared/responses";

export class ApiRouter {
  constructor(
    private readonly files: FeatureApiHandler,
    private readonly widgets: FeatureApiHandler,
    private readonly storageStatus: FeatureApiHandler,
    private readonly novelAiImages: FeatureApiHandler,
    private readonly identities: IdentityVerifier,
    private readonly serviceRequests: RequestVerifier,
  ) {}

  async handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname === NOVELAI_IMAGE_UPLOAD_API_PATH) {
        await this.serviceRequests.verify(request);
        const response = await this.novelAiImages.handle(request, url);
        if (response !== null) {
          return response;
        }
        throw new AppError(HTTP_ERRORS.ROUTE_NOT_FOUND);
      }

      const identity = await this.identities.verify(request);
      this.assertSameOrigin(request, url);

      if (url.pathname === API_PATHS.SESSION) {
        return this.handleSession(request, identity);
      }
      const fileResponse = await this.files.handle(request, url);
      if (fileResponse !== null) {
        return fileResponse;
      }
      const widgetResponse = await this.widgets.handle(request, url);
      if (widgetResponse !== null) {
        return widgetResponse;
      }
      const storageStatusResponse = await this.storageStatus.handle(request, url);
      if (storageStatusResponse !== null) {
        return storageStatusResponse;
      }
      throw new AppError(HTTP_ERRORS.ROUTE_NOT_FOUND);
    } catch (error) {
      return errorResponse(error);
    }
  }

  private handleSession(request: Request, identity: Identity): Response {
    if (request.method !== HTTP_METHOD.GET) {
      throw new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
    }
    const session = {
      email: identity.email,
      logoutUrl: ACCESS_LOGOUT_PATH,
      filePolicy: { maxUploadSizeBytes: MAX_FILE_SIZE_BYTES },
    } satisfies SessionInfo;
    return jsonResponse(session);
  }

  private assertSameOrigin(request: Request, url: URL): void {
    if (request.method === HTTP_METHOD.GET) {
      return;
    }
    if (request.headers.get(HTTP_HEADERS.ORIGIN) !== url.origin) {
      throw new AppError(HTTP_ERRORS.CROSS_ORIGIN_REQUEST);
    }
  }
}
