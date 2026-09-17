import { FilesystemScrollRetention } from "@client/components/filesystem/filesystem-scroll-retention";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useState, type FormEvent } from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "@/constants/filesystem/filesystem";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { usePaginatedDirectory } from "@client/hooks/filesystem/directory/use-paginated-directory";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import { DesktopModal } from "@client/components/desktop/desktop-modal";

interface NameDialogProps {
  readonly title: string;
  readonly label: string;
  readonly initialValue?: string;
  readonly busy: boolean;
  readonly onSubmit: (name: string) => void;
  readonly onCancel: () => void;
}

export function NameDialog({
  title,
  label,
  initialValue = "",
  busy,
  onSubmit,
  onCancel,
}: NameDialogProps) {
  const [name, setName] = useState(initialValue);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (name.trim()) {
      onSubmit(name);
    }
  };
  return (
    <DesktopModal
      title={title}
      onRequestClose={onCancel}
      closeDisabled={busy}
    >
      <form className="filesystem-dialog" onSubmit={submit}>
        <label>
          {label}
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="filesystem-dialog__actions">
          <button type="submit" disabled={busy || !name.trim()}>
            {busy ? FILESYSTEM_COPY.BUSY : FILESYSTEM_COPY.CONFIRM}
          </button>
          <button type="button" disabled={busy} onClick={onCancel}>
            {FILESYSTEM_COPY.CANCEL}
          </button>
        </div>
      </form>
    </DesktopModal>
  );
}

interface ConfirmDialogProps {
  readonly title: string;
  readonly message: string;
  readonly busy: boolean;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  busy,
  confirmLabel = FILESYSTEM_COPY.CONFIRM,
  cancelLabel = FILESYSTEM_COPY.CANCEL,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <DesktopModal
      title={title}
      onRequestClose={onCancel}
      closeDisabled={busy}
    >
      <section className="filesystem-dialog">
        <p>{message}</p>
        <div className="filesystem-dialog__actions">
          <button type="button" disabled={busy} onClick={onConfirm}>
            {busy ? FILESYSTEM_COPY.BUSY : confirmLabel}
          </button>
          <button type="button" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </section>
    </DesktopModal>
  );
}

interface DirectoryPickerDialogProps {
  readonly gateway: FilesystemGateway;
  readonly excludedEntryIds?: readonly string[];
  readonly busy: boolean;
  readonly onSelect: (directoryId: string) => void;
  readonly onCancel: () => void;
}

export function DirectoryPickerDialog({
  gateway,
  excludedEntryIds = [],
  busy,
  onSelect,
  onCancel,
}: DirectoryPickerDialogProps) {
  const [directoryId, setDirectoryId] = useState<string>(FILESYSTEM_ROOT_ID.DOCUMENTS);
  const { page, error, isLoadingMore, retry, loadMore } = usePaginatedDirectory({
    gateway, directoryId, errorFallback: FILESYSTEM_COPY.LOAD_FAILED,
  });

  return (
    <DesktopModal
      title={FILESYSTEM_COPY.MOVE_TITLE}
      iconPath={DESKTOP_ASSET_PATHS.FOLDER_ICON}
      onRequestClose={onCancel}
      closeDisabled={busy}
    >
      <section className="filesystem-dialog filesystem-dialog--picker">
        <div className="filesystem-save-roots">
          <button
            type="button"
            onClick={() => setDirectoryId(FILESYSTEM_ROOT_ID.DESKTOP)}
          >
            {FILESYSTEM_ROOT_NAME.DESKTOP}
          </button>
          <button
            type="button"
            onClick={() => setDirectoryId(FILESYSTEM_ROOT_ID.DOCUMENTS)}
          >
            {FILESYSTEM_ROOT_NAME.DOCUMENTS}
          </button>
        </div>
        {page ? (
          <>
            <div className="filesystem-picker__breadcrumbs">
              {page.breadcrumbs.map((item) => (
                <button key={item.id} type="button" onClick={() => setDirectoryId(item.id)}>
                  {item.name}
                </button>
              ))}
            </div>
            <div className="filesystem-picker__folders">
              <FilesystemScrollRetention location={directoryId} scope={gateway} />
              {page.items
                .filter(
                  (item) =>
                    item.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY &&
                    !excludedEntryIds.includes(item.id),
                )
                .map((item) => (
                  <button key={item.id} type="button" onDoubleClick={() => setDirectoryId(item.id)}>
                    <img src={DESKTOP_ASSET_PATHS.FOLDER_ICON} alt="" />
                    {item.name}
                  </button>
                ))}
            </div>
            {page.nextOffset !== null ? (
              <button
                type="button"
                className="explorer-load-more"
                disabled={isLoadingMore}
                onClick={loadMore}
              >
                {isLoadingMore
                  ? FILESYSTEM_COPY.BUSY
                  : FILESYSTEM_COPY.LOAD_MORE}
              </button>
            ) : null}
            {error ? <p role="alert">{error}</p> : null}
          </>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : (
          <p>{FILESYSTEM_COPY.BUSY}</p>
        )}
        {error ? (
          <button
            type="button"
            onClick={() => void retry()}
          >
            {FILESYSTEM_COPY.RETRY}
          </button>
        ) : null}
        <div className="filesystem-dialog__actions">
          <button
            type="button"
            disabled={busy || isLoadingMore || !page}
            onClick={() => page && onSelect(page.directory.id)}
          >
            {busy ? FILESYSTEM_COPY.BUSY : FILESYSTEM_COPY.MOVE_HERE}
          </button>
          <button type="button" disabled={busy} onClick={onCancel}>
            {FILESYSTEM_COPY.CANCEL}
          </button>
        </div>
      </section>
    </DesktopModal>
  );
}
