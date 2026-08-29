import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import {
  FILESYSTEM_SORT_COPY,
  FILESYSTEM_SORT_DIRECTION_LABELS,
  FILESYSTEM_SORT_FIELD_OPTIONS,
} from "@client/content/ko/filesystem/sort";
import { useState } from "react";
import { FILESYSTEM_SORT_DIRECTION_VALUES } from "@/constants/filesystem/sort";
import {
  isFilesystemSortDirection,
  isFilesystemSortField,
} from "@/domain/filesystem/filesystem-sort";
import type {
  FilesystemDirectoryEntry,
  FilesystemDirectorySort,
} from "@/types/filesystem/filesystem";
import { MobileDialog } from "@client/components/mobile/shared/mobile-dialog";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { messageFromError } from "@client/errors/error-message";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";

interface MobileDirectorySortDialogProps {
  readonly directory: FilesystemDirectoryEntry;
  readonly sort: FilesystemDirectorySort;
  readonly gateway: Pick<FilesystemDirectoryGateway, "updateDirectorySort">;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

export function MobileDirectorySortDialog({
  directory,
  sort,
  gateway,
  onClose,
  onSaved,
}: MobileDirectorySortDialogProps) {
  const [draft, setDraft] = useState(sort);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await gateway.updateDirectorySort(directory.id, draft);
      setSaving(false);
      onSaved();
    } catch (caught) {
      setError(messageFromError(caught, MOBILE_COPY.SORT_SAVE_FAILED));
      setSaving(false);
    }
  };

  return (
    <MobileDialog
      title={MOBILE_COPY.SORT_TITLE(directory.name)}
      actions={
        <>
          <button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? MOBILE_COPY.SAVING : MOBILE_COPY.APPLY}
          </button>
          <button type="button" disabled={saving} onClick={onClose}>
            {MOBILE_COPY.CANCEL}
          </button>
        </>
      }
    >
      <div className={MOBILE_CLASS_NAME.FOLDER_SORT}>
        <label className={MOBILE_CLASS_NAME.FIELD}>
          <span>{FILESYSTEM_SORT_COPY.FIELD_LABEL}</span>
          <select
            aria-label={FILESYSTEM_SORT_COPY.FIELD_LABEL}
            disabled={saving}
            value={draft.field}
            onChange={(event) => {
              if (!isFilesystemSortField(event.target.value)) return;
              const field = event.target.value;
              setDraft((current) => ({
                field,
                direction: current.direction,
              }));
              setError(null);
            }}
          >
            {FILESYSTEM_SORT_FIELD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={MOBILE_CLASS_NAME.FIELD}>
          <span>{FILESYSTEM_SORT_COPY.DIRECTION_LABEL}</span>
          <select
            aria-label={FILESYSTEM_SORT_COPY.DIRECTION_LABEL}
            disabled={saving}
            value={draft.direction}
            onChange={(event) => {
              if (!isFilesystemSortDirection(event.target.value)) return;
              const direction = event.target.value;
              setDraft((current) => ({
                field: current.field,
                direction,
              }));
              setError(null);
            }}
          >
            {FILESYSTEM_SORT_DIRECTION_VALUES.map((direction) => (
              <option key={direction} value={direction}>
                {FILESYSTEM_SORT_DIRECTION_LABELS[draft.field][direction]}
              </option>
            ))}
          </select>
        </label>
        {error ? (
          <p className={MOBILE_CLASS_NAME.ERROR} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </MobileDialog>
  );
}
