import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import {
  FILESYSTEM_SORT_DIRECTION,
  FILESYSTEM_SORT_FIELD,
} from "@/constants/filesystem/sort";
import type {
  FilesystemDirectorySort,
  FilesystemSortDirection,
  FilesystemSortField,
} from "@/types/filesystem/filesystem";

const SORT_DIRECTION_SQL = {
  [FILESYSTEM_SORT_DIRECTION.ASCENDING]: "ASC",
  [FILESYSTEM_SORT_DIRECTION.DESCENDING]: "DESC",
} as const satisfies Record<FilesystemSortDirection, string>;

const SORT_EXPRESSION_SQL = {
  [FILESYSTEM_SORT_FIELD.NAME]: "e.name_key",
  [FILESYSTEM_SORT_FIELD.CREATED_AT]: "e.created_at",
  [FILESYSTEM_SORT_FIELD.UPDATED_AT]: "e.updated_at",
  [FILESYSTEM_SORT_FIELD.TYPE]:
    `CASE WHEN e.kind = '${FILESYSTEM_ENTRY_KIND.WIDGET}' ` +
    "THEN 'widget:' || COALESCE(w.type, '') " +
    "ELSE LOWER(TRIM(CASE " +
    "WHEN INSTR(f.content_type, ';') > 0 " +
    "THEN SUBSTR(f.content_type, 1, INSTR(f.content_type, ';') - 1) " +
    "ELSE COALESCE(f.content_type, '') END)) END",
  [FILESYSTEM_SORT_FIELD.SIZE]: "f.size",
} as const satisfies Record<FilesystemSortField, string>;

export function directoryOrderClause(sort: FilesystemDirectorySort): string {
  const direction = SORT_DIRECTION_SQL[sort.direction];
  const expression = SORT_EXPRESSION_SQL[sort.field];
  const sizePresenceOrder =
    sort.field === FILESYSTEM_SORT_FIELD.SIZE
      ? `CASE WHEN e.kind = '${FILESYSTEM_ENTRY_KIND.FILE}' THEN 0 ELSE 1 END ASC,`
      : "";
  return `CASE e.kind WHEN '${FILESYSTEM_ENTRY_KIND.DIRECTORY}' THEN 0 ELSE 1 END ASC,
          ${sizePresenceOrder}
          ${expression} ${direction}, e.name_key ASC, e.id ASC`;
}
