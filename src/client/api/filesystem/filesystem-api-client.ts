import {
  API_PATHS,
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
  FILESYSTEM_API_PATHS,
} from "@/constants/platform/api";
import { DEFAULT_CONTENT_TYPE } from "@/constants/filesystem/file";
import { isFilesystemDirectorySort } from "@/domain/filesystem/filesystem-sort";
import {
  HTTP_HEADERS,
  HTTP_METHOD,
} from "@/constants/platform/http";
import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
  FilesystemEntry,
  FilesystemFileEntry,
  FilesystemMutationResult,
  FilesystemTrashPage,
  FilesystemWidgetEntry,
  MoveFilesystemEntryInput,
  RestoreFilesystemEntryInput,
  DesktopPlacement,
  UpdateFilesystemEntryInput,
} from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { FilesystemDownloadManifest } from "@/types/filesystem/download";
import type { FilesystemDirectoryDetails } from "@/types/filesystem/directory-details";
import {
  isBatchResult,
  isDirectoryEntry,
  isDirectoryDetails,
  isDirectoryPage,
  isDownloadManifest,
  isFileEntry,
  isFilesystemEntry,
  isMutationResult,
  isRecord,
  isTrashPage,
  readApiError,
} from "@client/api/filesystem/filesystem-api-contract";
import {
  appendPlacementQuery,
  jsonRequest,
  placementBody,
} from "@client/api/filesystem/filesystem-api-request";
import { API_REQUEST_OPTIONS } from "@client/constants/shared/api";
import { CLIENT_ERRORS } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

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

export class FilesystemApiClient implements FilesystemGateway {
  async listDirectory(
    parentId?: string,
    offset = 0,
  ): Promise<FilesystemDirectoryPage> {
    const query = new URLSearchParams({
      [API_QUERY_PARAMETERS.OFFSET]: String(offset),
    });
    if (parentId) {
      query.set(API_QUERY_PARAMETERS.PARENT_ID, parentId);
    }
    const value = await this.requestJson(`${FILESYSTEM_ENTRIES_PATH}?${query}`);
    if (!isDirectoryPage(value)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value;
  }

  async createDirectory(
    parentId: string,
    name: string,
    desktopPlacement?: DesktopPlacement,
  ): Promise<FilesystemDirectoryEntry> {
    const value = await this.requestJson(
      FILESYSTEM_DIRECTORIES_PATH,
      jsonRequest(HTTP_METHOD.POST, {
        parentId,
        name,
        ...placementBody(desktopPlacement),
      }),
    );
    if (!isRecord(value) || !isDirectoryEntry(value.directory)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value.directory;
  }

  async getDirectoryDetails(
    directoryId: string,
  ): Promise<FilesystemDirectoryDetails> {
    const value = await this.requestJson(
      `${FILESYSTEM_DIRECTORIES_PATH}/${encodeURIComponent(directoryId)}/${API_PATH_SEGMENTS.DETAILS}`,
    );
    if (!isRecord(value) || !isDirectoryDetails(value.details)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value.details;
  }

  async updateDirectorySort(
    directoryId: string,
    sort: FilesystemDirectorySort,
  ): Promise<FilesystemDirectorySort> {
    const value = await this.requestJson(
      `${FILESYSTEM_DIRECTORIES_PATH}/${encodeURIComponent(directoryId)}/${API_PATH_SEGMENTS.SORT}`,
      jsonRequest(HTTP_METHOD.PUT, sort),
    );
    if (!isRecord(value) || !isFilesystemDirectorySort(value.sort)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value.sort;
  }

  async uploadFile(
    parentId: string,
    file: File,
    desktopPlacement?: DesktopPlacement,
  ): Promise<FilesystemFileEntry> {
    const query = new URLSearchParams({
      [API_QUERY_PARAMETERS.PARENT_ID]: parentId,
      [API_QUERY_PARAMETERS.FILE_NAME]: file.name,
    });
    appendPlacementQuery(query, desktopPlacement);
    const value = await this.requestJson(`${API_PATHS.FILES}?${query}`, {
      method: HTTP_METHOD.POST,
      headers: {
        [HTTP_HEADERS.CONTENT_TYPE]: file.type || DEFAULT_CONTENT_TYPE,
        [HTTP_HEADERS.FILE_SIZE]: String(file.size),
      },
      body: file,
    });
    if (!isRecord(value) || !isFileEntry(value.file)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value.file;
  }

  async updateEntry(
    id: string,
    input: UpdateFilesystemEntryInput,
  ): Promise<FilesystemEntry> {
    const value = await this.requestJson(
      `${FILESYSTEM_ENTRIES_PATH}/${encodeURIComponent(id)}`,
      jsonRequest(HTTP_METHOD.PATCH, input),
    );
    if (!isRecord(value) || !isFilesystemEntry(value.entry)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value.entry;
  }

  async moveEntry(
    id: string,
    input: MoveFilesystemEntryInput,
  ): Promise<FilesystemEntry> {
    const value = await this.requestJson(
      `${FILESYSTEM_ENTRIES_PATH}/${encodeURIComponent(id)}/${API_PATH_SEGMENTS.MOVE}`,
      jsonRequest(HTTP_METHOD.POST, {
        parentId: input.parentId,
        ...placementBody(input.desktopPlacement),
      }),
    );
    if (!isRecord(value) || !isFilesystemEntry(value.entry)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value.entry;
  }

  async moveEntries(
    ids: readonly string[],
    input: MoveFilesystemEntryInput,
  ): Promise<FilesystemBatchResult> {
    const value = await this.requestJson(
      FILESYSTEM_BATCH_MOVE_PATH,
      jsonRequest(HTTP_METHOD.POST, {
        entryIds: ids,
        parentId: input.parentId,
        ...placementBody(input.desktopPlacement),
      }),
    );
    if (!isBatchResult(value)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value;
  }

  async trashEntry(id: string): Promise<FilesystemMutationResult> {
    const value = await this.requestJson(`${FILESYSTEM_ENTRIES_PATH}/${encodeURIComponent(id)}`, {
      method: HTTP_METHOD.DELETE,
    });
    if (!isMutationResult(value)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value;
  }

  async trashEntries(ids: readonly string[]): Promise<FilesystemBatchResult> {
    return this.requestBatch(FILESYSTEM_BATCH_TRASH_PATH, ids);
  }

  async createDownloadManifest(
    ids: readonly string[],
  ): Promise<FilesystemDownloadManifest> {
    const value = await this.requestJson(
      FILESYSTEM_DOWNLOAD_MANIFEST_PATH,
      jsonRequest(HTTP_METHOD.POST, { entryIds: ids }),
    );
    if (!isDownloadManifest(value)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value;
  }

  downloadUrl(id: string): string {
    return `${API_PATHS.FILES}/${encodeURIComponent(id)}/download`;
  }

  contentUrl(id: string): string {
    return `${API_PATHS.FILES}/${encodeURIComponent(id)}/${API_PATH_SEGMENTS.CONTENT}`;
  }

  thumbnailUrl(id: string): string {
    return `${API_PATHS.FILES}/${encodeURIComponent(id)}/${API_PATH_SEGMENTS.THUMBNAIL}`;
  }

  async listTrash(offset = 0): Promise<FilesystemTrashPage> {
    const query = new URLSearchParams({
      [API_QUERY_PARAMETERS.OFFSET]: String(offset),
    });
    const value = await this.requestJson(`${FILESYSTEM_TRASH_PATH}?${query}`);
    if (!isTrashPage(value)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value;
  }

  async restoreEntry(
    id: string,
    input: RestoreFilesystemEntryInput = {},
  ): Promise<FilesystemEntry> {
    const value = await this.requestJson(
      `${FILESYSTEM_TRASH_PATH}/${encodeURIComponent(id)}/${API_PATH_SEGMENTS.RESTORE}`,
      jsonRequest(HTTP_METHOD.POST, {
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
        ...placementBody(input.desktopPlacement),
      }),
    );
    if (!isRecord(value) || !isFilesystemEntry(value.entry)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value.entry;
  }

  async restoreEntries(
    ids: readonly string[],
    input: RestoreFilesystemEntryInput = {},
  ): Promise<FilesystemBatchResult> {
    const value = await this.requestJson(
      FILESYSTEM_BATCH_RESTORE_PATH,
      jsonRequest(HTTP_METHOD.POST, {
        entryIds: ids,
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
        ...placementBody(input.desktopPlacement),
      }),
    );
    if (!isBatchResult(value)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value;
  }

  async permanentlyDeleteEntry(id: string): Promise<void> {
    await this.requestJson(`${FILESYSTEM_TRASH_PATH}/${encodeURIComponent(id)}`, {
      method: HTTP_METHOD.DELETE,
    });
  }

  async permanentlyDeleteEntries(
    ids: readonly string[],
  ): Promise<FilesystemBatchResult> {
    return this.requestBatch(FILESYSTEM_BATCH_DELETE_PATH, ids);
  }

  async emptyTrash(): Promise<void> {
    await this.requestJson(FILESYSTEM_TRASH_PATH, {
      method: HTTP_METHOD.DELETE,
    });
  }

  private async requestJson(
    url: string,
    options: RequestInit = {},
  ): Promise<unknown> {
    const response = await fetch(url, {
      credentials: API_REQUEST_OPTIONS.CREDENTIALS,
      ...options,
    });
    if (response.status === 204) {
      if (!response.ok) {
        throw new ClientError(CLIENT_ERRORS.REQUEST_FAILED);
      }
      return null;
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = readApiError(payload);
      throw new FilesystemApiError(error.code, error.message, response.status);
    }
    return payload;
  }

  private async requestBatch(
    path: string,
    ids: readonly string[],
  ): Promise<FilesystemBatchResult> {
    const value = await this.requestJson(
      path,
      jsonRequest(HTTP_METHOD.POST, { entryIds: ids }),
    );
    if (!isBatchResult(value)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value;
  }
}

export class FilesystemApiError extends ClientError {
  constructor(code: string, message: string, readonly status: number) {
    super({ code, message });
    this.name = "FilesystemApiError";
  }
}
