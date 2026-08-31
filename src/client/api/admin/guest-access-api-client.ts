import {
  GUEST_ACCESS_API_PATH,
  GUEST_ACCESS_API_PATHS,
  API_QUERY_PARAMETERS,
} from "@/constants/platform/api";
import { HTTP_METHOD } from "@/constants/platform/http";
import type { GuestAccessSettings } from "@/types/admin/guest-access";
import {
  isGuestAccessDirectoryPage,
  isGuestAccessSettings,
  isGuestPublicationMutationResult,
} from "@client/api/admin/guest-access-api-contract";
import { isRecord } from "@client/api/shared/api-contract";
import { jsonRequest, requestJson } from "@client/api/shared/api-request";
import { CLIENT_ERROR_CODE } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type { GuestAccessGateway } from "@client/types/admin/guest-access";

export class GuestAccessApiClient implements GuestAccessGateway {
  async getSettings(): Promise<GuestAccessSettings> {
    const value = await requestJson(GUEST_ACCESS_API_PATH);
    return readSettingsEnvelope(value);
  }

  async updateSettings(enabled: boolean): Promise<GuestAccessSettings> {
    const value = await requestJson(
      GUEST_ACCESS_API_PATH,
      jsonRequest(HTTP_METHOD.PATCH, { enabled }),
    );
    return readSettingsEnvelope(value);
  }

  async listDirectory(directoryId: string, offset = 0) {
    const query = new URLSearchParams({
      [API_QUERY_PARAMETERS.OFFSET]: String(offset),
    });
    const value = await requestJson(
      `${GUEST_ACCESS_API_PATHS.DIRECTORIES}/${encodeURIComponent(directoryId)}?${query}`,
    );
    if (!isGuestAccessDirectoryPage(value)) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return value;
  }

  async setEntryPublished(entryId: string, published: boolean) {
    const value = await requestJson(
      `${GUEST_ACCESS_API_PATHS.ENTRIES}/${encodeURIComponent(entryId)}`,
      jsonRequest(HTTP_METHOD.PUT, { published }),
    );
    if (!isGuestPublicationMutationResult(value)) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return value;
  }
}

function readSettingsEnvelope(value: unknown): GuestAccessSettings {
  if (!isRecord(value) || !isGuestAccessSettings(value.settings)) {
    throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
  }
  return value.settings;
}
