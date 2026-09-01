import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { DESKTOP_MODAL_VARIANT } from "@client/constants/desktop/modal";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import type { UploadTransferState } from "@client/types/filesystem/upload";
import { DesktopModal } from "@client/components/desktop/desktop-modal";

interface UploadTransferDialogProps {
  readonly state: UploadTransferState;
  readonly onClose: () => void;
}

export function UploadTransferDialog({
  state,
  onClose,
}: UploadTransferDialogProps) {
  if (!state.isOpen) return null;
  const summary = state.isRunning
    ? FILESYSTEM_COPY.TRANSFER_PROGRESS
    : state.failures.length > 0
      ? FILESYSTEM_COPY.TRANSFER_PARTIAL
      : FILESYSTEM_COPY.TRANSFER_COMPLETE;
  return (
    <DesktopModal
      title={FILESYSTEM_COPY.TRANSFER_TITLE}
      iconPath={DESKTOP_ASSET_PATHS.FILE_ICON}
      variant={DESKTOP_MODAL_VARIANT.TRANSFER}
      onRequestClose={onClose}
      closeDisabled={state.isRunning}
    >
      <section className="filesystem-dialog filesystem-transfer__window">
        <p>{summary}</p>
        <progress max={state.total} value={state.completed} />
        <span>{state.completed} / {state.total}</span>
        {state.notice ? <p>{state.notice}</p> : null}
        {state.failures.length > 0 ? (
          <ul className="filesystem-transfer__failures">
            {state.failures.map((failure, index) => (
              <li key={`${failure.path}-${index}`}>
                <strong>{failure.path}</strong>{" "}
                <span>
                  [{failure.skipped
                    ? FILESYSTEM_COPY.TRANSFER_SKIPPED_ITEM
                    : FILESYSTEM_COPY.TRANSFER_FAILURE_ITEM}]
                </span>
                : {failure.message}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="filesystem-dialog__actions">
          <button type="button" disabled={state.isRunning} onClick={onClose}>
            {FILESYSTEM_COPY.CLOSE}
          </button>
        </div>
      </section>
    </DesktopModal>
  );
}
