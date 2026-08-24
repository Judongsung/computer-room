import {
  API_PATHS,
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
  FILESYSTEM_API_PATHS,
} from "@/constants/platform/api";
import { DEFAULT_CONTENT_TYPE } from "@/constants/filesystem/file";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { isFilesystemDirectorySort } from "@/domain/filesystem/filesystem-sort";
import { WIDGET_TYPE_VALUES } from "@/constants/widgets/widget";
import {
  HTTP_HEADERS,
  HTTP_MEDIA_TYPE,
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

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { [HTTP_HEADERS.CONTENT_TYPE]: HTTP_MEDIA_TYPE.JSON },
    body: JSON.stringify(body),
  };
}

export class FilesystemApiError extends ClientError {
  constructor(code: string, message: string, readonly status: number) {
    super({ code, message });
    this.name = "FilesystemApiError";
  }
}

function isDirectoryPage(value: unknown): value is FilesystemDirectoryPage {
  return (
    isRecord(value) &&
    isDirectoryEntry(value.directory) &&
    Array.isArray(value.breadcrumbs) &&
    value.breadcrumbs.every(isBreadcrumb) &&
    Array.isArray(value.items) &&
    value.items.every(isFilesystemEntry) &&
    (value.nextOffset === null || typeof value.nextOffset === "number") &&
    isFilesystemDirectorySort(value.sort)
  );
}

function isTrashPage(value: unknown): value is FilesystemTrashPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        isRecord(item) &&
        isFilesystemEntry(item.entry) &&
        typeof item.deletedAt === "string" &&
        (item.originalParentId === null ||
          typeof item.originalParentId === "string") &&
        typeof item.originalLocation === "string",
    ) &&
    (value.nextOffset === null || typeof value.nextOffset === "number")
  );
}

export function isFilesystemEntry(value: unknown): value is FilesystemEntry {
  return isDirectoryEntry(value) || isFileEntry(value) || isWidgetEntry(value);
}

function isDirectoryEntry(value: unknown): value is FilesystemDirectoryEntry {
  return isBaseEntry(value) && value.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY;
}

function isFileEntry(value: unknown): value is FilesystemFileEntry {
  return (
    isBaseEntry(value) &&
    value.kind === FILESYSTEM_ENTRY_KIND.FILE &&
    typeof value.parentId === "string" &&
    typeof value.contentType === "string" &&
    typeof value.size === "number"
  );
}

export function isWidgetEntry(value: unknown): value is FilesystemWidgetEntry {
  return (
    isBaseEntry(value) &&
    value.kind === FILESYSTEM_ENTRY_KIND.WIDGET &&
    typeof value.parentId === "string" &&
    typeof value.widgetId === "string" &&
    WIDGET_TYPE_VALUES.some((type) => value.widgetType === type)
  );
}

function isBaseEntry(value: unknown): value is Record<string, unknown> & {
  id: string;
  parentId: string | null;
  kind: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  desktopOrder: number | null;
} {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.parentId === null || typeof value.parentId === "string") &&
    typeof value.kind === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
    && (value.desktopOrder === null || typeof value.desktopOrder === "number")
  );
}

function isMutationResult(value: unknown): value is FilesystemMutationResult {
  return (
    isRecord(value) &&
    (value.entry === null || isFilesystemEntry(value.entry)) &&
    Array.isArray(value.closedWidgetIds) &&
    value.closedWidgetIds.every((id) => typeof id === "string")
  );
}

function isBatchResult(value: unknown): value is FilesystemBatchResult {
  return (
    isRecord(value) &&
    Array.isArray(value.succeededIds) &&
    value.succeededIds.every((id) => typeof id === "string") &&
    Array.isArray(value.entries) &&
    value.entries.every(isFilesystemEntry) &&
    Array.isArray(value.failures) &&
    value.failures.every(
      (failure) =>
        isRecord(failure) &&
        typeof failure.id === "string" &&
        typeof failure.code === "string" &&
        typeof failure.message === "string",
    ) &&
    Array.isArray(value.closedWidgetIds) &&
    value.closedWidgetIds.every((id) => typeof id === "string")
  );
}

function isDownloadManifest(value: unknown): value is FilesystemDownloadManifest {
  return (
    isRecord(value) &&
    typeof value.archiveName === "string" &&
    Array.isArray(value.entries) &&
    value.entries.every((entry) => {
      if (!isRecord(entry) || typeof entry.path !== "string" ||
          typeof entry.updatedAt !== "string") {
        return false;
      }
      if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) return true;
      return (
        entry.kind === FILESYSTEM_ENTRY_KIND.FILE &&
        typeof entry.id === "string" &&
        typeof entry.size === "number" &&
        Number.isSafeInteger(entry.size) &&
        entry.size >= 0 &&
        typeof entry.downloadUrl === "string" &&
        entry.downloadUrl ===
          `${API_PATHS.FILES}/${encodeURIComponent(entry.id)}/download`
      );
    }) &&
    typeof value.totalFileCount === "number" &&
    Number.isSafeInteger(value.totalFileCount) &&
    value.totalFileCount >= 0 &&
    typeof value.totalBytes === "number" &&
    Number.isSafeInteger(value.totalBytes) &&
    value.totalBytes >= 0 &&
    Array.isArray(value.skippedWidgetIds) &&
    value.skippedWidgetIds.every((id) => typeof id === "string")
  );
}

function placementBody(
  placement?: DesktopPlacement,
): Record<string, number> {
  return placement
    ? {
        [API_QUERY_PARAMETERS.DESKTOP_TARGET_INDEX]: placement.targetIndex,
        [API_QUERY_PARAMETERS.DESKTOP_CAPACITY]: placement.capacity,
      }
    : {};
}

function appendPlacementQuery(
  query: URLSearchParams,
  placement?: DesktopPlacement,
): void {
  if (!placement) return;
  query.set(
    API_QUERY_PARAMETERS.DESKTOP_TARGET_INDEX,
    String(placement.targetIndex),
  );
  query.set(
    API_QUERY_PARAMETERS.DESKTOP_CAPACITY,
    String(placement.capacity),
  );
}

function isBreadcrumb(value: unknown): boolean {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";
}

function readApiError(value: unknown): { code: string; message: string } {
  if (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  ) {
    return { code: value.error.code, message: value.error.message };
  }
  return CLIENT_ERRORS.REQUEST_FAILED;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
