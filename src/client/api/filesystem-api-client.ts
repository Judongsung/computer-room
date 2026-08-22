import {
  API_PATHS,
  API_PATH_SEGMENTS,
  API_QUERY_PARAMETERS,
} from "../../constants/api";
import { DEFAULT_CONTENT_TYPE } from "../../constants/file";
import { FILESYSTEM_ENTRY_KIND } from "../../constants/filesystem";
import {
  HTTP_HEADERS,
  HTTP_MEDIA_TYPE,
  HTTP_METHOD,
} from "../../constants/http";
import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemEntry,
  FilesystemFileEntry,
  FilesystemTrashPage,
  UpdateFilesystemEntryInput,
} from "../../types/filesystem";
import { API_REQUEST_OPTIONS } from "../constants/api";
import { CLIENT_ERRORS } from "../constants/errors";
import { ClientError } from "../errors/client-error";
import type { FilesystemGateway } from "../types/filesystem";

const FILESYSTEM_ENTRIES_PATH = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.ENTRIES}`;
const FILESYSTEM_DIRECTORIES_PATH = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.DIRECTORIES}`;
const FILESYSTEM_TRASH_PATH = `${API_PATHS.FILESYSTEM}/${API_PATH_SEGMENTS.TRASH}`;

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
  ): Promise<FilesystemDirectoryEntry> {
    const value = await this.requestJson(
      FILESYSTEM_DIRECTORIES_PATH,
      jsonRequest(HTTP_METHOD.POST, { parentId, name }),
    );
    if (!isRecord(value) || !isDirectoryEntry(value.directory)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value.directory;
  }

  async uploadFile(
    parentId: string,
    file: File,
  ): Promise<FilesystemFileEntry> {
    const query = new URLSearchParams({
      [API_QUERY_PARAMETERS.PARENT_ID]: parentId,
      [API_QUERY_PARAMETERS.FILE_NAME]: file.name,
    });
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

  async trashEntry(id: string): Promise<void> {
    await this.requestJson(`${FILESYSTEM_ENTRIES_PATH}/${encodeURIComponent(id)}`, {
      method: HTTP_METHOD.DELETE,
    });
  }

  downloadUrl(id: string): string {
    return `${API_PATHS.FILES}/${encodeURIComponent(id)}/download`;
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

  async restoreEntry(id: string): Promise<FilesystemEntry> {
    const value = await this.requestJson(
      `${FILESYSTEM_TRASH_PATH}/${encodeURIComponent(id)}/${API_PATH_SEGMENTS.RESTORE}`,
      { method: HTTP_METHOD.POST },
    );
    if (!isRecord(value) || !isFilesystemEntry(value.entry)) {
      throw new ClientError(CLIENT_ERRORS.INVALID_RESPONSE);
    }
    return value.entry;
  }

  async permanentlyDeleteEntry(id: string): Promise<void> {
    await this.requestJson(`${FILESYSTEM_TRASH_PATH}/${encodeURIComponent(id)}`, {
      method: HTTP_METHOD.DELETE,
    });
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
    (value.nextOffset === null || typeof value.nextOffset === "number")
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
        typeof item.originalLocation === "string",
    ) &&
    (value.nextOffset === null || typeof value.nextOffset === "number")
  );
}

function isFilesystemEntry(value: unknown): value is FilesystemEntry {
  return isDirectoryEntry(value) || isFileEntry(value);
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

function isBaseEntry(value: unknown): value is Record<string, unknown> & {
  id: string;
  parentId: string | null;
  kind: string;
  name: string;
  createdAt: string;
  updatedAt: string;
} {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.parentId === null || typeof value.parentId === "string") &&
    typeof value.kind === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
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
