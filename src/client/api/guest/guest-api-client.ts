import { API_PATH_SEGMENTS, API_QUERY_PARAMETERS, GUEST_API_PATHS } from "@/constants/platform/api";
import type { FilesystemDirectoryPage } from "@/types/filesystem/filesystem";
import type {
  GuestProgramDocument,
  GuestSessionInfo,
} from "@/types/guest/guest";
import { isDirectoryPage } from "@client/api/filesystem/filesystem-api-contract";
import {
  isGuestProgramDocument,
  isGuestSessionInfo,
} from "@client/api/guest/guest-api-contract";
import { requestJson } from "@client/api/shared/api-request";
import { CLIENT_ERROR_CODE } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type { GuestGateway } from "@client/types/guest/guest";

export class GuestApiClient implements GuestGateway {
  async getSession(): Promise<GuestSessionInfo> {
    const value = await requestJson(GUEST_API_PATHS.SESSION);
    if (!isGuestSessionInfo(value)) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return value;
  }

  async listDirectory(
    directoryId: string,
    offset = 0,
  ): Promise<FilesystemDirectoryPage> {
    const query = new URLSearchParams({
      [API_QUERY_PARAMETERS.OFFSET]: String(offset),
    });
    const value = await requestJson(
      `${GUEST_API_PATHS.DIRECTORIES}/${encodeURIComponent(directoryId)}?${query}`,
    );
    if (!isDirectoryPage(value)) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return value;
  }

  async getProgramDocument(entryId: string): Promise<GuestProgramDocument> {
    const value = await requestJson(
      `${GUEST_API_PATHS.PROGRAM_DOCUMENTS}/${encodeURIComponent(entryId)}`,
    );
    if (!isGuestProgramDocument(value)) {
      throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
    }
    return value;
  }

  downloadUrl(entryId: string): string {
    return this.fileActionUrl(entryId, API_PATH_SEGMENTS.DOWNLOAD);
  }

  contentUrl(entryId: string): string {
    return this.fileActionUrl(entryId, API_PATH_SEGMENTS.CONTENT);
  }

  thumbnailUrl(entryId: string): string {
    return this.fileActionUrl(entryId, API_PATH_SEGMENTS.THUMBNAIL);
  }

  private fileActionUrl(entryId: string, action: string): string {
    return `${GUEST_API_PATHS.FILES}/${encodeURIComponent(entryId)}/${action}`;
  }
}
