import {
  FILESYSTEM_PATH_SEPARATOR,
} from "@/constants/filesystem/filesystem";
import { KOREA_LOCALE } from "@/constants/platform/date";
import type { FilesystemDirectoryDetails } from "@/types/filesystem/directory-details";
import {
  FOLDER_PROPERTIES_COPY,
  FOLDER_PROPERTIES_DATE_TIME_FORMAT_OPTIONS,
  FOLDER_PROPERTIES_STATUS,
} from "@client/constants/filesystem/details";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import type { FolderPropertiesController } from "@client/types/filesystem/folder-properties";
import { formatFileSize } from "@client/utils/format-file-size";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(
  KOREA_LOCALE,
  FOLDER_PROPERTIES_DATE_TIME_FORMAT_OPTIONS,
);

export function FolderPropertiesDialog({
  controller,
}: {
  readonly controller: FolderPropertiesController;
}) {
  const { state } = controller;
  if (state.status === FOLDER_PROPERTIES_STATUS.CLOSED) return null;

  const name =
    state.status === FOLDER_PROPERTIES_STATUS.READY
      ? state.details.directory.name
      : state.target.name;
  const isLoading = state.status === FOLDER_PROPERTIES_STATUS.LOADING;
  const isError = state.status === FOLDER_PROPERTIES_STATUS.ERROR;

  return (
    <div className="filesystem-dialog-backdrop">
      <section
        className="filesystem-dialog folder-properties-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={FOLDER_PROPERTIES_COPY.TITLE(name)}
      >
        <header className="folder-properties-dialog__header">
          <img src={DESKTOP_ASSET_PATHS.FOLDER_ICON} alt="" />
          <strong>{FOLDER_PROPERTIES_COPY.TITLE(name)}</strong>
        </header>
        <div className="folder-properties-dialog__content" aria-live="polite">
          {isLoading ? <p>{FOLDER_PROPERTIES_COPY.LOADING}</p> : null}
          {isError ? <p role="alert">{state.message}</p> : null}
          {state.status === FOLDER_PROPERTIES_STATUS.READY ? (
            <FolderPropertiesDetails details={state.details} />
          ) : null}
        </div>
        <div className="filesystem-dialog__actions">
          <button
            type="button"
            disabled={isLoading}
            onClick={controller.refresh}
          >
            {isError
              ? FOLDER_PROPERTIES_COPY.RETRY
              : FOLDER_PROPERTIES_COPY.REFRESH}
          </button>
          <button type="button" autoFocus onClick={controller.close}>
            {FOLDER_PROPERTIES_COPY.CLOSE}
          </button>
        </div>
      </section>
    </div>
  );
}

function FolderPropertiesDetails({
  details,
}: {
  readonly details: FilesystemDirectoryDetails;
}) {
  const path = details.breadcrumbs
    .map((breadcrumb) => breadcrumb.name)
    .join(FILESYSTEM_PATH_SEPARATOR);
  return (
    <dl className="folder-properties-dialog__details">
      <PropertyRow
        label={FOLDER_PROPERTIES_COPY.TYPE}
        value={FOLDER_PROPERTIES_COPY.TYPE_VALUE}
      />
      <PropertyRow label={FOLDER_PROPERTIES_COPY.LOCATION} value={path} />
      <PropertyRow
        label={FOLDER_PROPERTIES_COPY.SIZE}
        value={FOLDER_PROPERTIES_COPY.SIZE_VALUE(
          formatFileSize(details.totalBytes),
          details.totalBytes.toLocaleString(KOREA_LOCALE),
        )}
      />
      <PropertyRow
        label={FOLDER_PROPERTIES_COPY.CONTAINS}
        value={FOLDER_PROPERTIES_COPY.CONTAINS_VALUE(
          details.fileCount.toLocaleString(KOREA_LOCALE),
          details.directoryCount.toLocaleString(KOREA_LOCALE),
          details.widgetCount.toLocaleString(KOREA_LOCALE),
        )}
      />
      <PropertyRow
        label={FOLDER_PROPERTIES_COPY.CREATED_AT}
        value={DATE_TIME_FORMATTER.format(new Date(details.directory.createdAt))}
      />
      <PropertyRow
        label={FOLDER_PROPERTIES_COPY.UPDATED_AT}
        value={DATE_TIME_FORMATTER.format(new Date(details.directory.updatedAt))}
      />
    </dl>
  );
}

function PropertyRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
