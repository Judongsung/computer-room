import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import { FILESYSTEM_COPY } from "@client/constants/filesystem/filesystem";

export function FilesystemBatchResultDialog({
  result,
  onClose,
}: {
  readonly result: FilesystemBatchResult | null;
  readonly onClose: () => void;
}) {
  if (!result || result.failures.length === 0) return null;
  return (
    <div className="filesystem-dialog-backdrop">
      <section
        className="filesystem-dialog"
        role="dialog"
        aria-label={FILESYSTEM_COPY.BATCH_RESULT_TITLE}
      >
        <strong>{FILESYSTEM_COPY.BATCH_RESULT_TITLE}</strong>
        <p>{FILESYSTEM_COPY.BATCH_PARTIAL}</p>
        <p>{FILESYSTEM_COPY.BATCH_SUCCESS_COUNT(result.succeededIds.length)}</p>
        <ul className="filesystem-transfer__failures">
          {result.failures.map((failure) => (
            <li key={failure.id}>
              <code>{failure.id}</code>: {failure.message} ({failure.code})
            </li>
          ))}
        </ul>
        <div className="filesystem-dialog__actions">
          <button type="button" onClick={onClose}>
            {FILESYSTEM_COPY.CLOSE}
          </button>
        </div>
      </section>
    </div>
  );
}
