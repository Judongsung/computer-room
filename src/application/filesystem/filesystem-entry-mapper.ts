import { FILE_STATUS } from "@/constants/filesystem/file";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import type {
  FilesystemDirectoryEntry,
  FilesystemEntry,
  FilesystemEntryRecord,
} from "@/types/filesystem/filesystem";

export function toPublicEntry(entry: FilesystemEntryRecord): FilesystemEntry {
  if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
    return toPublicDirectory(entry);
  }
  if (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET) {
    if (!entry.widgetId || !entry.widgetType || !entry.parentId) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
    }
    return {
      id: entry.id,
      parentId: entry.parentId,
      kind: FILESYSTEM_ENTRY_KIND.WIDGET,
      name: entry.name,
      widgetId: entry.widgetId,
      widgetType: entry.widgetType,
      createdAt: toIsoString(entry.createdAt),
      updatedAt: toIsoString(entry.updatedAt),
      desktopOrder: entry.desktopOrder,
    };
  }
  if (
    entry.fileStatus !== FILE_STATUS.READY ||
    entry.contentType === null ||
    entry.size === null ||
    entry.parentId === null
  ) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  return {
    id: entry.id,
    parentId: entry.parentId,
    kind: FILESYSTEM_ENTRY_KIND.FILE,
    name: entry.name,
    contentType: entry.contentType,
    size: entry.size,
    createdAt: toIsoString(entry.createdAt),
    updatedAt: toIsoString(entry.updatedAt),
    desktopOrder: entry.desktopOrder,
  };
}

export function toPublicDirectory(
  entry: FilesystemEntryRecord,
): FilesystemDirectoryEntry {
  return {
    id: entry.id,
    parentId: entry.parentId,
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name: entry.name,
    createdAt: toIsoString(entry.createdAt),
    updatedAt: toIsoString(entry.updatedAt),
    desktopOrder: entry.desktopOrder,
  };
}

function toIsoString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}
