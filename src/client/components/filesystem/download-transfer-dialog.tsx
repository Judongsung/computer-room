import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { FILESYSTEM_DOWNLOAD_STATUS } from "@client/constants/filesystem/download";
import { DESKTOP_MODAL_VARIANT } from "@client/constants/desktop/modal";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import type { FilesystemDownloadState } from "@client/types/filesystem/download";
import { formatFileSize } from "@client/utils/format-file-size";
import { DesktopModal } from "@client/components/desktop/desktop-modal";

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
    <DesktopModal
      title={FILESYSTEM_COPY.DOWNLOAD_TITLE}
      iconPath={DESKTOP_ASSET_PATHS.FILE_ICON}
      variant={DESKTOP_MODAL_VARIANT.TRANSFER}
      onRequestClose={isError ? onClose : onCancel}
      closeDisabled={!isError}
    >
      <section className="filesystem-dialog filesystem-transfer__window">
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
    </DesktopModal>
  );
}
