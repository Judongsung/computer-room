import {
  FILESYSTEM_SORT_DIRECTION,
  FILESYSTEM_SORT_FIELD,
} from "@/constants/filesystem/sort";
import type {
  FilesystemSortDirection,
  FilesystemSortField,
} from "@/types/filesystem/filesystem";

export const FILESYSTEM_SORT_COPY = {
  GROUP_LABEL: "폴더 정렬",
  FIELD_LABEL: "정렬 기준",
  DIRECTION_LABEL: "정렬 방향",
} as const;

export const FILESYSTEM_SORT_FIELD_OPTIONS: readonly {
  readonly value: FilesystemSortField;
  readonly label: string;
}[] = [
  { value: FILESYSTEM_SORT_FIELD.NAME, label: "이름" },
  { value: FILESYSTEM_SORT_FIELD.CREATED_AT, label: "만든 날짜" },
  { value: FILESYSTEM_SORT_FIELD.UPDATED_AT, label: "수정한 날짜" },
  { value: FILESYSTEM_SORT_FIELD.TYPE, label: "종류" },
  { value: FILESYSTEM_SORT_FIELD.SIZE, label: "크기" },
];

export const FILESYSTEM_SORT_DIRECTION_LABELS = {
  [FILESYSTEM_SORT_FIELD.NAME]: {
    [FILESYSTEM_SORT_DIRECTION.ASCENDING]: "오름차순",
    [FILESYSTEM_SORT_DIRECTION.DESCENDING]: "내림차순",
  },
  [FILESYSTEM_SORT_FIELD.CREATED_AT]: {
    [FILESYSTEM_SORT_DIRECTION.ASCENDING]: "오래된 항목부터",
    [FILESYSTEM_SORT_DIRECTION.DESCENDING]: "최신 항목부터",
  },
  [FILESYSTEM_SORT_FIELD.UPDATED_AT]: {
    [FILESYSTEM_SORT_DIRECTION.ASCENDING]: "오래된 항목부터",
    [FILESYSTEM_SORT_DIRECTION.DESCENDING]: "최신 항목부터",
  },
  [FILESYSTEM_SORT_FIELD.TYPE]: {
    [FILESYSTEM_SORT_DIRECTION.ASCENDING]: "오름차순",
    [FILESYSTEM_SORT_DIRECTION.DESCENDING]: "내림차순",
  },
  [FILESYSTEM_SORT_FIELD.SIZE]: {
    [FILESYSTEM_SORT_DIRECTION.ASCENDING]: "작은 항목부터",
    [FILESYSTEM_SORT_DIRECTION.DESCENDING]: "큰 항목부터",
  },
} as const satisfies Record<
  FilesystemSortField,
  Record<FilesystemSortDirection, string>
>;

export const FILESYSTEM_SORT_CLASS_NAME = {
  BAR: "explorer-sort-bar",
  CONTROL: "explorer-sort-control",
  LABEL: "explorer-sort-control__label",
} as const;
