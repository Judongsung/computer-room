import { FILESYSTEM_COPY } from "../../constants/filesystem";
import type { UploadTransferState } from "../../types/upload";

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
    <div className="filesystem-transfer">
      <section
        className="filesystem-dialog filesystem-transfer__window"
        role="dialog"
        aria-label={FILESYSTEM_COPY.TRANSFER_TITLE}
      >
        <strong>{FILESYSTEM_COPY.TRANSFER_TITLE}</strong>
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
    </div>
  );
}
