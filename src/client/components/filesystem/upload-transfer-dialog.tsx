import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { DESKTOP_MODAL_VARIANT } from "@client/constants/desktop/modal";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import type { UploadTransferState } from "@client/types/filesystem/upload";
import { DesktopModal } from "@client/components/desktop/desktop-modal";

interface UploadTransferDialogProps {
  readonly state: UploadTransferState;
  readonly onClose: () => void;
  readonly onStop: () => void;
  readonly onRetry: () => Promise<void>;
}

export function UploadTransferDialog({
  state,
  onClose,
  onStop,
  onRetry,
}: UploadTransferDialogProps) {
  if (!state.isOpen) return null;
  const summary = state.isRunning
    ? FILESYSTEM_COPY.TRANSFER_PROGRESS
    : state.succeeded < state.total
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
        <span>{FILESYSTEM_COPY.TRANSFER_COUNTS(
          state.total, state.succeeded, state.failures.length, state.remaining,
        )}</span>
        {state.isStopping ? <p>{FILESYSTEM_COPY.TRANSFER_STOPPING}</p> : null}
        {!state.isRunning && state.succeeded < state.total ? (
          <>
            <p>{FILESYSTEM_COPY.TRANSFER_RETRY_NOTICE}</p>
            <p>{FILESYSTEM_COPY.TRANSFER_CLOSE_NOTICE}</p>
          </>
        ) : null}
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
          {state.isRunning ? (
            <button type="button" disabled={state.isStopping} onClick={onStop}>
              {FILESYSTEM_COPY.TRANSFER_STOP}
            </button>
          ) : state.succeeded < state.total ? (
            <button type="button" onClick={() => void onRetry()}>
              {FILESYSTEM_COPY.TRANSFER_RETRY}
            </button>
          ) : null}
          <button type="button" disabled={state.isRunning} onClick={onClose}>
            {FILESYSTEM_COPY.CLOSE}
          </button>
        </div>
      </section>
    </DesktopModal>
  );
}
