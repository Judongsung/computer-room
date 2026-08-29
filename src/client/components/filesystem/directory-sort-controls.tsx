import {
  FILESYSTEM_SORT_COPY,
  FILESYSTEM_SORT_DIRECTION_LABELS,
  FILESYSTEM_SORT_FIELD_OPTIONS,
} from "@client/content/ko/filesystem/sort";
import { FILESYSTEM_SORT_DIRECTION_VALUES } from "@/constants/filesystem/sort";
import {
  isFilesystemSortDirection,
  isFilesystemSortField,
} from "@/domain/filesystem/filesystem-sort";
import type {
  FilesystemDirectorySort,
  FilesystemDirectoryPage,
} from "@/types/filesystem/filesystem";
import { FILESYSTEM_SORT_CLASS_NAME } from "@client/constants/filesystem/sort";

interface DirectorySortControlsProps {
  readonly page: FilesystemDirectoryPage | null;
  readonly busy: boolean;
  readonly onChange: (sort: FilesystemDirectorySort) => void;
}

export function DirectorySortControls({
  page,
  busy,
  onChange,
}: DirectorySortControlsProps) {
  return (
    <div
      className={FILESYSTEM_SORT_CLASS_NAME.BAR}
      role="group"
      aria-label={FILESYSTEM_SORT_COPY.GROUP_LABEL}
    >
      <label className={FILESYSTEM_SORT_CLASS_NAME.CONTROL}>
        <span className={FILESYSTEM_SORT_CLASS_NAME.LABEL}>
          {FILESYSTEM_SORT_COPY.FIELD_LABEL}
        </span>
        <select
          aria-label={FILESYSTEM_SORT_COPY.FIELD_LABEL}
          disabled={!page || busy}
          value={page?.sort.field ?? ""}
          onChange={(event) => {
            if (!page || !isFilesystemSortField(event.target.value)) return;
            onChange({ field: event.target.value, direction: page.sort.direction });
          }}
        >
          {FILESYSTEM_SORT_FIELD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className={FILESYSTEM_SORT_CLASS_NAME.CONTROL}>
        <span className={FILESYSTEM_SORT_CLASS_NAME.LABEL}>
          {FILESYSTEM_SORT_COPY.DIRECTION_LABEL}
        </span>
        <select
          aria-label={FILESYSTEM_SORT_COPY.DIRECTION_LABEL}
          disabled={!page || busy}
          value={page?.sort.direction ?? ""}
          onChange={(event) => {
            if (!page || !isFilesystemSortDirection(event.target.value)) return;
            onChange({ field: page.sort.field, direction: event.target.value });
          }}
        >
          {FILESYSTEM_SORT_DIRECTION_VALUES.map((direction) => (
            <option key={direction} value={direction}>
              {page ? FILESYSTEM_SORT_DIRECTION_LABELS[page.sort.field][direction] : direction}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
