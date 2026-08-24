import { API_PATHS } from "@/constants/platform/api";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE_VALUES } from "@/constants/widgets/widget";
import { isFilesystemDirectorySort } from "@/domain/filesystem/filesystem-sort";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { FilesystemDownloadManifest } from "@/types/filesystem/download";
import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemEntry,
  FilesystemFileEntry,
  FilesystemMutationResult,
  FilesystemTrashPage,
  FilesystemWidgetEntry,
} from "@/types/filesystem/filesystem";
import { CLIENT_ERRORS } from "@client/constants/shared/errors";

export function isDirectoryPage(value: unknown): value is FilesystemDirectoryPage {
  return isRecord(value) && isDirectoryEntry(value.directory) &&
    Array.isArray(value.breadcrumbs) && value.breadcrumbs.every(isBreadcrumb) &&
    Array.isArray(value.items) && value.items.every(isFilesystemEntry) &&
    (value.nextOffset === null || typeof value.nextOffset === "number") &&
    isFilesystemDirectorySort(value.sort);
}

export function isTrashPage(value: unknown): value is FilesystemTrashPage {
  return isRecord(value) && Array.isArray(value.items) && value.items.every((item) =>
    isRecord(item) && isFilesystemEntry(item.entry) &&
    typeof item.deletedAt === "string" &&
    (item.originalParentId === null || typeof item.originalParentId === "string") &&
    typeof item.originalLocation === "string") &&
    (value.nextOffset === null || typeof value.nextOffset === "number");
}

export function isFilesystemEntry(value: unknown): value is FilesystemEntry {
  return isDirectoryEntry(value) || isFileEntry(value) || isWidgetEntry(value);
}

export function isDirectoryEntry(value: unknown): value is FilesystemDirectoryEntry {
  return isBaseEntry(value) && value.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY;
}

export function isFileEntry(value: unknown): value is FilesystemFileEntry {
  return isBaseEntry(value) && value.kind === FILESYSTEM_ENTRY_KIND.FILE &&
    typeof value.parentId === "string" && typeof value.contentType === "string" &&
    typeof value.size === "number";
}

export function isWidgetEntry(value: unknown): value is FilesystemWidgetEntry {
  return isBaseEntry(value) && value.kind === FILESYSTEM_ENTRY_KIND.WIDGET &&
    typeof value.parentId === "string" && typeof value.widgetId === "string" &&
    WIDGET_TYPE_VALUES.some((type) => value.widgetType === type);
}

export function isMutationResult(value: unknown): value is FilesystemMutationResult {
  return isRecord(value) && (value.entry === null || isFilesystemEntry(value.entry)) &&
    Array.isArray(value.closedWidgetIds) && value.closedWidgetIds.every(isString);
}

export function isBatchResult(value: unknown): value is FilesystemBatchResult {
  return isRecord(value) && Array.isArray(value.succeededIds) &&
    value.succeededIds.every(isString) && Array.isArray(value.entries) &&
    value.entries.every(isFilesystemEntry) && Array.isArray(value.failures) &&
    value.failures.every((failure) => isRecord(failure) &&
      typeof failure.id === "string" && typeof failure.code === "string" &&
      typeof failure.message === "string") && Array.isArray(value.closedWidgetIds) &&
    value.closedWidgetIds.every(isString);
}

export function isDownloadManifest(value: unknown): value is FilesystemDownloadManifest {
  return isRecord(value) && typeof value.archiveName === "string" &&
    Array.isArray(value.entries) && value.entries.every((entry) => {
      if (!isRecord(entry) || typeof entry.path !== "string" || typeof entry.updatedAt !== "string") return false;
      if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) return true;
      return entry.kind === FILESYSTEM_ENTRY_KIND.FILE && typeof entry.id === "string" &&
        typeof entry.size === "number" && Number.isSafeInteger(entry.size) && entry.size >= 0 &&
        typeof entry.downloadUrl === "string" &&
        entry.downloadUrl === `${API_PATHS.FILES}/${encodeURIComponent(entry.id)}/download`;
    }) && isNonNegativeInteger(value.totalFileCount) && isNonNegativeInteger(value.totalBytes) &&
    Array.isArray(value.skippedWidgetIds) && value.skippedWidgetIds.every(isString);
}

export function readApiError(value: unknown): { code: string; message: string } {
  if (isRecord(value) && isRecord(value.error) &&
    typeof value.error.code === "string" && typeof value.error.message === "string") {
    return { code: value.error.code, message: value.error.message };
  }
  return CLIENT_ERRORS.REQUEST_FAILED;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBaseEntry(value: unknown): value is Record<string, unknown> & {
  id: string; parentId: string | null; kind: string; name: string;
  createdAt: string; updatedAt: string; desktopOrder: number | null;
} {
  return isRecord(value) && typeof value.id === "string" &&
    (value.parentId === null || typeof value.parentId === "string") &&
    typeof value.kind === "string" && typeof value.name === "string" &&
    typeof value.createdAt === "string" && typeof value.updatedAt === "string" &&
    (value.desktopOrder === null || typeof value.desktopOrder === "number");
}

function isBreadcrumb(value: unknown): boolean {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
