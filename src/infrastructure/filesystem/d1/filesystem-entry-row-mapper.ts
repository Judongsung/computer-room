import { FILE_STATUS } from "@/constants/filesystem/file";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { WIDGET_TYPE_VALUES } from "@/constants/widgets/widget";
import { AppError } from "@/domain/shared/errors";
import type { FilesystemEntryRow } from "@/types/platform/database";
import type { FilesystemEntryRecord } from "@/types/filesystem/filesystem";

export function mapFilesystemEntryRow(
  row: FilesystemEntryRow,
): FilesystemEntryRecord {
  if (
    row.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY &&
    row.kind !== FILESYSTEM_ENTRY_KIND.FILE &&
    row.kind !== FILESYSTEM_ENTRY_KIND.WIDGET
  ) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  if (
    row.file_status !== null &&
    row.file_status !== FILE_STATUS.PENDING &&
    row.file_status !== FILE_STATUS.READY
  ) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  const widgetType = WIDGET_TYPE_VALUES.find(
    (candidate) => candidate === row.widget_type,
  );
  if (
    row.kind === FILESYSTEM_ENTRY_KIND.WIDGET &&
    (!row.widget_id || !widgetType || !row.parent_id)
  ) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  if (row.widget_open !== null && row.widget_open !== 0 && row.widget_open !== 1) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  return {
    id: row.id,
    parentId: row.parent_id,
    kind: row.kind,
    name: row.name,
    nameKey: row.name_key,
    fileId: row.file_id,
    widgetId: row.widget_id,
    restoreParentId: row.restore_parent_id,
    restorePath: row.restore_path,
    trashedAt: row.trashed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    objectKey: row.object_key,
    contentType: row.content_type,
    size: row.size,
    etag: row.etag,
    fileStatus: row.file_status,
    widgetType: widgetType ?? null,
    widgetOpen: row.widget_open === null ? null : row.widget_open === 1,
    desktopOrder: row.desktop_order,
  };
}
