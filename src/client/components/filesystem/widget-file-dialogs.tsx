import { useEffect, useState, type FormEvent } from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { WidgetType } from "@/types/widgets/widget";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { CHECKLIST_WIDGET_COPY, MEMO_WIDGET_COPY } from "@client/constants/widgets/content";
import { FILESYSTEM_COPY } from "@client/constants/filesystem/filesystem";
import { messageFromError } from "@client/errors/error-message";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

interface WidgetSaveDialogProps {
  readonly gateway: FilesystemGateway;
  readonly widgetType: WidgetType;
  readonly busy: boolean;
  readonly onSave: (parentId: string, name: string) => void;
  readonly onCancel: () => void;
}

export function WidgetSaveDialog({
  gateway,
  widgetType,
  busy,
  onSave,
  onCancel,
}: WidgetSaveDialogProps) {
  const [directoryId, setDirectoryId] = useState<string>(
    FILESYSTEM_ROOT_ID.DOCUMENTS,
  );
  const [page, setPage] = useState<
    Awaited<ReturnType<FilesystemGateway["listDirectory"]>> | null
  >(null);
  const [name, setName] = useState<string>(
    widgetType === WIDGET_TYPE.MEMO
      ? MEMO_WIDGET_COPY.TITLE
      : CHECKLIST_WIDGET_COPY.TITLE,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    setPage(null);
    setError(null);
    setIsLoadingMore(false);
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

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (name.trim()) onSave(directoryId, name);
  };
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
      <form
        className="filesystem-dialog filesystem-dialog--picker"
        role="dialog"
        aria-label={FILESYSTEM_COPY.SAVE_WIDGET_TITLE}
        onSubmit={submit}
      >
        <strong>{FILESYSTEM_COPY.SAVE_WIDGET_TITLE}</strong>
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
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDirectoryId(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <div className="filesystem-picker__folders">
              {page.items
                .filter(
                  (entry) => entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY,
                )
                .map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onDoubleClick={() => setDirectoryId(entry.id)}
                  >
                    <img src={DESKTOP_ASSET_PATHS.FOLDER_ICON} alt="" />
                    {entry.name}
                  </button>
                ))}
            </div>
            {page.nextOffset !== null ? (
              <button
                type="button"
                className="explorer-load-more"
                disabled={isLoadingMore || busy}
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
        <label>
          {FILESYSTEM_COPY.FILE_NAME}
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <div className="filesystem-dialog__actions">
          <button
            type="submit"
            disabled={busy || isLoadingMore || !page || !name.trim()}
          >
            {busy ? FILESYSTEM_COPY.BUSY : FILESYSTEM_COPY.SAVE_HERE}
          </button>
          <button type="button" disabled={busy} onClick={onCancel}>
            {FILESYSTEM_COPY.CANCEL}
          </button>
        </div>
      </form>
    </div>
  );
}

interface UnsavedWidgetDialogProps {
  readonly busy: boolean;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly onCancel: () => void;
}

export function UnsavedWidgetDialog({
  busy,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedWidgetDialogProps) {
  return (
    <div className="filesystem-dialog-backdrop">
      <section
        className="filesystem-dialog"
        role="dialog"
        aria-label={FILESYSTEM_COPY.UNSAVED_CLOSE_TITLE}
      >
        <strong>{FILESYSTEM_COPY.UNSAVED_CLOSE_TITLE}</strong>
        <p>{FILESYSTEM_COPY.UNSAVED_CLOSE_MESSAGE}</p>
        <div className="filesystem-dialog__actions">
          <button type="button" disabled={busy} onClick={onSave}>
            {FILESYSTEM_COPY.SAVE}
          </button>
          <button type="button" disabled={busy} onClick={onDiscard}>
            {FILESYSTEM_COPY.DONT_SAVE}
          </button>
          <button type="button" disabled={busy} onClick={onCancel}>
            {FILESYSTEM_COPY.CANCEL}
          </button>
        </div>
      </section>
    </div>
  );
}
