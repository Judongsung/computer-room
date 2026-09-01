import { HTTP_METHOD } from "@/constants/platform/http";
import { ACCESS_LOGOUT_REQUEST_POLICY } from "@client/constants/platform/access";
import { API_REQUEST_OPTIONS } from "@client/constants/shared/api";
import { CLIENT_ERROR_CODE } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type { AccessLogoutGateway } from "@client/types/platform/access";

export class AccessApiClient implements AccessLogoutGateway {
  async logout(logoutUrl: string): Promise<void> {
    const response = await fetch(logoutUrl, {
      method: HTTP_METHOD.GET,
      credentials: API_REQUEST_OPTIONS.CREDENTIALS,
      cache: ACCESS_LOGOUT_REQUEST_POLICY.CACHE,
    });
    if (!response.ok) {
      throw new ClientError(CLIENT_ERROR_CODE.REQUEST_FAILED);
    }
  }
}
