import { API_PATHS } from "../constants/api";
import { ACCESS_LOGOUT_PATH } from "../constants/auth";
import { HTTP_ERRORS } from "../constants/errors/http";
import { MAX_FILE_SIZE_BYTES } from "../constants/file";
import { HTTP_HEADERS, HTTP_METHOD } from "../constants/http";
import { AppError } from "../domain/errors";
import type { Identity, IdentityVerifier, SessionInfo } from "../types/auth";
import type { FeatureApiHandler } from "../types/http";
import { errorResponse, jsonResponse } from "./responses";

export class ApiRouter {
  constructor(
    private readonly files: FeatureApiHandler,
    private readonly widgets: FeatureApiHandler,
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
      const fileResponse = await this.files.handle(request, url);
      if (fileResponse !== null) {
        return fileResponse;
      }
      const widgetResponse = await this.widgets.handle(request, url);
      if (widgetResponse !== null) {
        return widgetResponse;
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
