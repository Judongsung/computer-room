import { API_QUERY_PARAMETERS, FILESYSTEM_API_PATHS } from "@/constants/platform/api";
import { requestJson } from "@client/api/shared/api-request";
import { isRecord } from "@client/api/shared/api-contract";
import { isFilesystemEntry } from "@client/api/filesystem/filesystem-api-contract";
import { CLIENT_ERROR_CODE } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type { FilesystemSearchPage, FilesystemSearchQuery } from "@/types/filesystem/search/search";

export async function searchFilesystem(query: FilesystemSearchQuery, offset: number): Promise<FilesystemSearchPage> {
  const parameters = new URLSearchParams({
    [API_QUERY_PARAMETERS.SEARCH_QUERY]: query.q,
    [API_QUERY_PARAMETERS.SEARCH_KIND]: query.kind,
    [API_QUERY_PARAMETERS.OFFSET]: String(offset),
  });
  if (query.directoryId !== undefined) {
    parameters.set(API_QUERY_PARAMETERS.SEARCH_DIRECTORY_ID, query.directoryId);
  }
  const value = await requestJson(`${FILESYSTEM_API_PATHS.SEARCH}?${parameters}`);
  if (!isSearchPage(value)) throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
  return value;
}

function isSearchPage(value: unknown): value is FilesystemSearchPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every((item) =>
      isRecord(item) && isFilesystemEntry(item.entry) && typeof item.parentPath === "string",
    ) &&
    (value.nextOffset === null || (
      typeof value.nextOffset === "number" &&
      Number.isSafeInteger(value.nextOffset) &&
      value.nextOffset >= 0
    ))
  );
}
