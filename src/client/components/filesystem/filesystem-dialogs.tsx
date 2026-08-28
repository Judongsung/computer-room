import { useEffect, useState, type FormEvent } from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "@/constants/filesystem/filesystem";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { FILESYSTEM_COPY } from "@client/constants/filesystem/filesystem";
import { messageFromError } from "@client/errors/error-message";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

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
    <div className="filesystem-dialog-backdrop">
      <form className="filesystem-dialog" role="dialog" aria-label={title} onSubmit={submit}>
        <strong>{title}</strong>
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
    </div>
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
    <div className="filesystem-dialog-backdrop">
      <section className="filesystem-dialog" role="dialog" aria-label={title}>
        <strong>{title}</strong>
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
    </div>
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
  const [directoryId, setDirectoryId] = useState<string | undefined>();
  const [page, setPage] = useState<Awaited<ReturnType<FilesystemGateway["listDirectory"]>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    setPage(null);
    setError(null);
    void gateway
      .listDirectory(directoryId)
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(messageFromError(reason, FILESYSTEM_COPY.LOAD_FAILED));
        }
      });
    return () => {
      active = false;
    };
  }, [directoryId, gateway]);

  const loadMore = (): void => {
    if (!page || page.nextOffset === null || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);
    void gateway
      .listDirectory(page.directory.id, page.nextOffset)
      .then((next) => {
        setPage((current) =>
          current?.directory.id === next.directory.id
            ? { ...next, items: [...current.items, ...next.items] }
            : current,
        );
      })
      .catch((reason: unknown) =>
        setError(messageFromError(reason, FILESYSTEM_COPY.LOAD_FAILED)),
      )
      .finally(() => setIsLoadingMore(false));
  };

  return (
    <div className="filesystem-dialog-backdrop">
      <section className="filesystem-dialog filesystem-dialog--picker" role="dialog" aria-label={FILESYSTEM_COPY.MOVE_TITLE}>
        <strong>{FILESYSTEM_COPY.MOVE_TITLE}</strong>
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
    </div>
  );
}
