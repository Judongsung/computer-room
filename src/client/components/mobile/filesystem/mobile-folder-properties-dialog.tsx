import { UI_LOCALE } from "@client/content/ko/shared/format";
import {
  FOLDER_PROPERTIES_COPY,
  FOLDER_PROPERTIES_DATE_TIME_FORMAT_OPTIONS,
} from "@client/content/ko/filesystem/details";
import { FILESYSTEM_PATH_SEPARATOR } from "@/constants/filesystem/filesystem";
import type { FilesystemDirectoryDetails } from "@/types/filesystem/directory-details";
import { MobileDialog } from "@client/components/mobile/shared/mobile-dialog";
import { FOLDER_PROPERTIES_STATUS } from "@client/constants/filesystem/details";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import type { FolderPropertiesController } from "@client/types/filesystem/folder-properties";
import { formatFileSize } from "@client/utils/format-file-size";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(
  UI_LOCALE,
  FOLDER_PROPERTIES_DATE_TIME_FORMAT_OPTIONS,
);

export function MobileFolderPropertiesDialog({
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
    <MobileDialog
      title={FOLDER_PROPERTIES_COPY.TITLE(name)}
      actions={
        <>
          <button
            type="button"
            disabled={isLoading}
            onClick={controller.refresh}
          >
            {isError
              ? FOLDER_PROPERTIES_COPY.RETRY
              : FOLDER_PROPERTIES_COPY.REFRESH}
          </button>
          <button type="button" onClick={controller.close}>
            {FOLDER_PROPERTIES_COPY.CLOSE}
          </button>
        </>
      }
    >
      <div aria-live="polite">
        {isLoading ? <p>{FOLDER_PROPERTIES_COPY.LOADING}</p> : null}
        {isError ? <p role="alert">{state.message}</p> : null}
        {state.status === FOLDER_PROPERTIES_STATUS.READY ? (
          <FolderDetails details={state.details} />
        ) : null}
      </div>
    </MobileDialog>
  );
}

function FolderDetails({
  details,
}: {
  readonly details: FilesystemDirectoryDetails;
}) {
  const path = details.breadcrumbs
    .map((breadcrumb) => breadcrumb.name)
    .join(FILESYSTEM_PATH_SEPARATOR);
  return (
    <dl className={MOBILE_CLASS_NAME.FOLDER_DETAILS}>
      <PropertyRow
        label={FOLDER_PROPERTIES_COPY.TYPE}
        value={FOLDER_PROPERTIES_COPY.TYPE_VALUE}
      />
      <PropertyRow label={FOLDER_PROPERTIES_COPY.LOCATION} value={path} />
      <PropertyRow
        label={FOLDER_PROPERTIES_COPY.SIZE}
        value={FOLDER_PROPERTIES_COPY.SIZE_VALUE(
          formatFileSize(details.totalBytes),
          details.totalBytes.toLocaleString(UI_LOCALE),
        )}
      />
      <PropertyRow
        label={FOLDER_PROPERTIES_COPY.CONTAINS}
        value={FOLDER_PROPERTIES_COPY.CONTAINS_VALUE(
          details.fileCount.toLocaleString(UI_LOCALE),
          details.directoryCount.toLocaleString(UI_LOCALE),
          details.widgetCount.toLocaleString(UI_LOCALE),
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
    <div className={MOBILE_CLASS_NAME.FOLDER_DETAILS_ROW}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
