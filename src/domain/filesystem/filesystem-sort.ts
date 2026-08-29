import {
  FILESYSTEM_SORT_DIRECTION,
  FILESYSTEM_SORT_DIRECTION_VALUES,
  FILESYSTEM_SORT_FIELD,
  FILESYSTEM_SORT_FIELD_VALUES,
} from "@/constants/filesystem/sort";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import type {
  FilesystemDirectorySort,
  FilesystemEntryRecord,
  FilesystemSortDirection,
  FilesystemSortField,
} from "@/types/filesystem/filesystem";
import { AppError } from "@/domain/shared/errors";

interface FilesystemSortStrategy {
  readonly compare: (
    left: FilesystemEntryRecord,
    right: FilesystemEntryRecord,
  ) => number;
  readonly comparePresence?: (
    left: FilesystemEntryRecord,
    right: FilesystemEntryRecord,
  ) => number;
}

const FILESYSTEM_SORT_STRATEGIES = {
  [FILESYSTEM_SORT_FIELD.NAME]: {
    compare: (left, right) => compareText(left.nameKey, right.nameKey),
  },
  [FILESYSTEM_SORT_FIELD.CREATED_AT]: {
    compare: (left, right) => left.createdAt - right.createdAt,
  },
  [FILESYSTEM_SORT_FIELD.UPDATED_AT]: {
    compare: (left, right) => left.updatedAt - right.updatedAt,
  },
  [FILESYSTEM_SORT_FIELD.TYPE]: {
    compare: (left, right) => compareText(entryTypeKey(left), entryTypeKey(right)),
  },
  [FILESYSTEM_SORT_FIELD.SIZE]: {
    compare: compareSize,
    comparePresence: compareSizePresence,
  },
} satisfies Record<FilesystemSortField, FilesystemSortStrategy>;

export function isFilesystemSortField(
  value: unknown,
): value is FilesystemSortField {
  return FILESYSTEM_SORT_FIELD_VALUES.some((field) => field === value);
}

export function isFilesystemSortDirection(
  value: unknown,
): value is FilesystemSortDirection {
  return FILESYSTEM_SORT_DIRECTION_VALUES.some(
    (direction) => direction === value,
  );
}

export function isFilesystemDirectorySort(
  value: unknown,
): value is FilesystemDirectorySort {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    isFilesystemSortField(candidate.field) &&
    isFilesystemSortDirection(candidate.direction)
  );
}

export function requireFilesystemDirectorySort(
  value: unknown,
): FilesystemDirectorySort {
  if (!isFilesystemDirectorySort(value)) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_DIRECTORY_SORT);
  }
  return { field: value.field, direction: value.direction };
}

export function compareFilesystemEntries(
  left: FilesystemEntryRecord,
  right: FilesystemEntryRecord,
  sort: FilesystemDirectorySort,
): number {
  const directoryRank = entryDirectoryRank(left) - entryDirectoryRank(right);
  if (directoryRank !== 0) return directoryRank;

  const strategy: FilesystemSortStrategy =
    FILESYSTEM_SORT_STRATEGIES[sort.field];
  const presence = strategy.comparePresence?.(left, right) ?? 0;
  if (presence !== 0) return presence;

  const direction =
    sort.direction === FILESYSTEM_SORT_DIRECTION.ASCENDING ? 1 : -1;
  const primary = strategy.compare(left, right) * direction;
  if (primary !== 0) return primary;

  const nameTie = compareText(left.nameKey, right.nameKey);
  return nameTie !== 0 ? nameTie : compareText(left.id, right.id);
}

function entryDirectoryRank(entry: FilesystemEntryRecord): number {
  return entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY ? 0 : 1;
}

function entryTypeKey(entry: FilesystemEntryRecord): string {
  if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) return "";
  if (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET) {
    return `widget:${entry.widgetType ?? ""}`;
  }
  return entry.contentType?.toLocaleLowerCase().split(";", 1)[0]?.trim() ?? "";
}

function compareSize(
  left: FilesystemEntryRecord,
  right: FilesystemEntryRecord,
): number {
  return (left.size ?? 0) - (right.size ?? 0);
}

function compareSizePresence(
  left: FilesystemEntryRecord,
  right: FilesystemEntryRecord,
): number {
  const leftHasSize = left.size !== null;
  const rightHasSize = right.size !== null;
  if (leftHasSize !== rightHasSize) return leftHasSize ? -1 : 1;
  return 0;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
