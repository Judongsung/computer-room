import { FILE_STATUS } from "@/constants/filesystem/file";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { FilesystemEntryRecord } from "@/types/filesystem/filesystem";

export function filesystemEntryRecord(
  id: string,
  kind: FilesystemEntryRecord["kind"],
  name: string,
  overrides: Partial<FilesystemEntryRecord> = {},
): FilesystemEntryRecord {
  const isFile = kind === FILESYSTEM_ENTRY_KIND.FILE;
  return {
    id,
    parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
    kind,
    name,
    nameKey: name.toLocaleLowerCase(),
    fileId: isFile ? id : null,
    widgetId: null,
    restoreParentId: null,
    restorePath: null,
    trashedAt: null,
    createdAt: 0,
    updatedAt: 0,
    objectKey: isFile ? `files/${id}` : null,
    contentType: isFile ? "application/octet-stream" : null,
    size: isFile ? 0 : null,
    etag: isFile ? "etag" : null,
    fileStatus: isFile ? FILE_STATUS.READY : null,
    widgetType: null,
    widgetOpen: null,
    desktopOrder: null,
    ...overrides,
  };
}
