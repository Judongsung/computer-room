import { FILESYSTEM_DOWNLOAD_STATUS } from "../../constants/filesystem-download";
import { FILESYSTEM_COPY } from "../../constants/filesystem";
import type { FilesystemDownloadState } from "../../types/filesystem-download";
import { formatFileSize } from "../../utils/format-file-size";

export function DownloadTransferDialog({
  state,
  onCancel,
  onClose,
}: {
  readonly state: FilesystemDownloadState;
  readonly onCancel: () => void;
  readonly onClose: () => void;
}) {
  if (state.status === FILESYSTEM_DOWNLOAD_STATUS.IDLE) return null;
  const isError = state.status === FILESYSTEM_DOWNLOAD_STATUS.ERROR;
  const progress =
    state.totalBytes > 0
      ? Math.min(1, state.transferredBytes / state.totalBytes)
      : undefined;
  return (
    <div className="filesystem-transfer">
      <section
        className="filesystem-dialog filesystem-transfer__window"
        role="dialog"
        aria-label={FILESYSTEM_COPY.DOWNLOAD_TITLE}
      >
        <strong>{FILESYSTEM_COPY.DOWNLOAD_TITLE}</strong>
        <p role={isError ? "alert" : undefined}>
          {isError
            ? state.error ?? FILESYSTEM_COPY.DOWNLOAD_FAILED
            : state.status === FILESYSTEM_DOWNLOAD_STATUS.PREPARING
              ? FILESYSTEM_COPY.DOWNLOAD_PREPARING
              : FILESYSTEM_COPY.DOWNLOAD_PROGRESS(
                  state.completedFiles,
                  state.totalFiles,
                )}
        </p>
        {!isError ? (
          <progress value={progress} max={1} />
        ) : null}
        {!isError && state.status === FILESYSTEM_DOWNLOAD_STATUS.DOWNLOADING ? (
          <small>
            {FILESYSTEM_COPY.DOWNLOAD_BYTE_PROGRESS(
              formatFileSize(state.transferredBytes),
              formatFileSize(state.totalBytes),
            )}
          </small>
        ) : null}
        {state.skippedWidgetCount > 0 ? (
          <small>
            {FILESYSTEM_COPY.DOWNLOAD_SKIPPED_WIDGETS(
              state.skippedWidgetCount,
            )}
          </small>
        ) : null}
        <div className="filesystem-dialog__actions">
          <button type="button" onClick={isError ? onClose : onCancel}>
            {isError
              ? FILESYSTEM_COPY.CLOSE
              : FILESYSTEM_COPY.DOWNLOAD_CANCEL}
          </button>
        </div>
      </section>
    </div>
  );
}
