import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { FILESYSTEM_ENTRY_KIND } from "../../../constants/filesystem";
import {
  isPotentialMediaContentType,
  mediaKindFromContentType,
} from "../../../domain/media-type";
import { DESKTOP_ASSET_PATHS } from "../../constants/desktop";
import {
  FILE_SIZE_DISPLAY,
  FILESYSTEM_COPY,
} from "../../constants/filesystem";
import { SYSTEM_APP_ID } from "../../constants/system-app";
import { MEDIA_VIEWER_COPY } from "../../constants/media";
import { KEYBOARD_KEY } from "../../constants/keyboard";
import type {
  FilesystemDirectoryPage,
  FilesystemEntry,
} from "../../../types/filesystem";
import type {
  FilesystemGateway,
  FilesystemWindowSyncProps,
} from "../../types/filesystem";
import type { SystemWindowChromeProps } from "../../types/system-app";
import type { MediaViewerOpenRequest } from "../../types/media";
import { downloadFile } from "../../utils/download-file";
import { SystemAppWindow } from "../desktop/system-app-window";
import {
  DirectoryPickerDialog,
  ConfirmDialog,
  NameDialog,
} from "./filesystem-dialogs";

type DocumentsDialog = "create" | "rename" | "move" | null;

interface DocumentsWindowProps
  extends SystemWindowChromeProps,
    FilesystemWindowSyncProps {
  readonly gateway: FilesystemGateway;
  readonly onOpenMedia: (request: MediaViewerOpenRequest) => void;
}

export function DocumentsWindow({
  gateway,
  onOpenMedia,
  filesystemRevision,
  onFilesystemChanged,
  ...chrome
}: DocumentsWindowProps) {
  const [directoryId, setDirectoryId] = useState<string | undefined>();
  const [history, setHistory] = useState<readonly string[]>([]);
  const [page, setPage] = useState<FilesystemDirectoryPage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<DocumentsDialog>(null);
  const [unsupportedMedia, setUnsupportedMedia] = useState<FilesystemEntry | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setPage(null);
    setSelectedId(null);
    setError(null);
    void gateway
      .listDirectory(directoryId)
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason, FILESYSTEM_COPY.LOAD_FAILED));
      });
    return () => {
      active = false;
    };
  }, [directoryId, filesystemRevision, gateway]);

  const selected = page?.items.find((item) => item.id === selectedId) ?? null;
  const currentDirectoryId = page?.directory.id;
  const runChange = useCallback(
    async (operation: () => Promise<unknown>): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        await operation();
        setDialog(null);
        setSelectedId(null);
        onFilesystemChanged();
      } catch (reason) {
        setError(errorMessage(reason, FILESYSTEM_COPY.CHANGE_FAILED));
      } finally {
        setBusy(false);
      }
    },
    [onFilesystemChanged],
  );

  const navigate = (nextId: string): void => {
    if (currentDirectoryId) {
      setHistory((current) => [...current, currentDirectoryId]);
    }
    setDirectoryId(nextId);
  };
  const navigateBack = (): void => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setDirectoryId(previous);
  };
  const navigateUp = (): void => {
    const parent = page?.breadcrumbs.at(-2);
    if (parent) navigate(parent.id);
  };
  const openEntry = (entry: FilesystemEntry): void => {
    if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      navigate(entry.id);
      return;
    }
    const kind = mediaKindFromContentType(entry.contentType);
    if (kind) {
      onOpenMedia({ entry, directoryId: entry.parentId, kind });
      return;
    }
    if (isPotentialMediaContentType(entry.contentType)) {
      setUnsupportedMedia(entry);
      return;
    }
    downloadFile(gateway.downloadUrl(entry.id));
  };
  const upload = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && currentDirectoryId) {
      void runChange(() => gateway.uploadFile(currentDirectoryId, file));
    }
  };
  const loadMore = (): void => {
    if (!page || page.nextOffset === null || busy) return;
    const directory = page.directory;
    setBusy(true);
    setError(null);
    void gateway
      .listDirectory(directory.id, page.nextOffset)
      .then((next) => {
        setPage((current) =>
          current?.directory.id === next.directory.id
            ? { ...next, items: [...current.items, ...next.items] }
            : current,
        );
      })
      .catch((reason: unknown) => {
        setError(errorMessage(reason, FILESYSTEM_COPY.LOAD_FAILED));
      })
      .finally(() => setBusy(false));
  };

  const toolbar = (
    <div className="explorer-toolbar" aria-label={FILESYSTEM_COPY.FILE_TOOLBAR}>
      <button type="button" disabled={history.length === 0 || busy} onClick={navigateBack}>
        {FILESYSTEM_COPY.BACK}
      </button>
      <button
        type="button"
        disabled={!page || page.breadcrumbs.length <= 1 || busy}
        onClick={navigateUp}
      >
        {FILESYSTEM_COPY.UP}
      </button>
      <span className="explorer-toolbar__separator" />
      <button type="button" disabled={!currentDirectoryId || busy} onClick={() => setDialog("create")}>
        {FILESYSTEM_COPY.NEW_FOLDER}
      </button>
      <button type="button" disabled={!currentDirectoryId || busy} onClick={() => fileInputRef.current?.click()}>
        {FILESYSTEM_COPY.UPLOAD}
      </button>
      <input ref={fileInputRef} className="visually-hidden" type="file" onChange={upload} />
      <span className="explorer-toolbar__separator" />
      <button
        type="button"
        disabled={!selected || selected.kind !== FILESYSTEM_ENTRY_KIND.FILE || busy}
        onClick={() =>
          selected && downloadFile(gateway.downloadUrl(selected.id))
        }
      >
        {FILESYSTEM_COPY.DOWNLOAD}
      </button>
      <button type="button" disabled={!selected || busy} onClick={() => setDialog("rename")}>
        {FILESYSTEM_COPY.RENAME}
      </button>
      <button type="button" disabled={!selected || busy} onClick={() => setDialog("move")}>
        {FILESYSTEM_COPY.MOVE}
      </button>
      <button
        type="button"
        disabled={!selected || busy}
        onClick={() => selected && void runChange(() => gateway.trashEntry(selected.id))}
      >
        {FILESYSTEM_COPY.DELETE}
      </button>
    </div>
  );

  return (
    <SystemAppWindow
      {...chrome}
      appId={SYSTEM_APP_ID.DOCUMENTS}
      toolbar={toolbar}
      bodyClassName="explorer-window__body"
      footer={
        <footer className="explorer-statusbar">
          {selected ? FILESYSTEM_COPY.SELECTED : `${page?.items.length ?? 0}${FILESYSTEM_COPY.ITEM_COUNT_SUFFIX}`}
        </footer>
      }
    >
      <div className="explorer-address">
        <span>{FILESYSTEM_COPY.ADDRESS}</span>
        <div>
          {page?.breadcrumbs.map((item, index) => (
            <span key={item.id}>
              {index > 0 ? " › " : ""}
              <button type="button" onClick={() => setDirectoryId(item.id)}>{item.name}</button>
            </span>
          ))}
        </div>
      </div>
      {error ? <p className="explorer-message" role="alert">{error}</p> : null}
      {!page && !error ? <p className="explorer-message">{FILESYSTEM_COPY.BUSY}</p> : null}
      {page ? (
        <div className="explorer-content" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedId(null);
        }}>
          {page.items.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === selectedId ? "explorer-item explorer-item--selected" : "explorer-item"}
              onClick={() => setSelectedId(entry.id)}
              onDoubleClick={() => openEntry(entry)}
              onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                if (event.key === KEYBOARD_KEY.ENTER) openEntry(entry);
              }}
            >
              <img
                src={
                  entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
                    ? DESKTOP_ASSET_PATHS.FOLDER_ICON
                    : DESKTOP_ASSET_PATHS.FILE_ICON
                }
                alt=""
              />
              <span>{entry.name}</span>
              {entry.kind === FILESYSTEM_ENTRY_KIND.FILE ? <small>{formatBytes(entry.size)}</small> : null}
            </button>
          ))}
          {page.items.length === 0 ? <p className="explorer-empty">{FILESYSTEM_COPY.EMPTY_DIRECTORY}</p> : null}
          {page.nextOffset !== null ? (
            <button
              type="button"
              className="explorer-load-more"
              disabled={busy}
              onClick={loadMore}
            >
              {FILESYSTEM_COPY.LOAD_MORE}
            </button>
          ) : null}
        </div>
      ) : null}
      {dialog === "create" && currentDirectoryId ? (
        <NameDialog
          title={FILESYSTEM_COPY.CREATE_FOLDER_TITLE}
          label={FILESYSTEM_COPY.FOLDER_NAME}
          busy={busy}
          onSubmit={(name) => void runChange(() => gateway.createDirectory(currentDirectoryId, name))}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === "rename" && selected ? (
        <NameDialog
          title={FILESYSTEM_COPY.RENAME_TITLE}
          label={FILESYSTEM_COPY.ENTRY_NAME}
          initialValue={selected.name}
          busy={busy}
          onSubmit={(name) => void runChange(() => gateway.updateEntry(selected.id, { name }))}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === "move" && selected ? (
        <DirectoryPickerDialog
          gateway={gateway}
          excludedEntryId={selected.id}
          busy={busy}
          onSelect={(parentId) => void runChange(() => gateway.updateEntry(selected.id, { parentId }))}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {unsupportedMedia && unsupportedMedia.kind === FILESYSTEM_ENTRY_KIND.FILE ? (
        <ConfirmDialog
          title={MEDIA_VIEWER_COPY.UNSUPPORTED_TITLE}
          message={MEDIA_VIEWER_COPY.UNSUPPORTED_MESSAGE}
          busy={false}
          confirmLabel={MEDIA_VIEWER_COPY.DOWNLOAD_FILE}
          cancelLabel={MEDIA_VIEWER_COPY.CANCEL}
          onConfirm={() => {
            downloadFile(gateway.downloadUrl(unsupportedMedia.id));
            setUnsupportedMedia(null);
          }}
          onCancel={() => setUnsupportedMedia(null)}
        />
      ) : null}
    </SystemAppWindow>
  );
}

function formatBytes(size: number): string {
  if (size < FILE_SIZE_DISPLAY.KILOBYTE_BYTES) {
    return `${size} ${FILESYSTEM_COPY.BYTE_UNIT}`;
  }
  if (size < FILE_SIZE_DISPLAY.MEGABYTE_BYTES) {
    return `${(size / FILE_SIZE_DISPLAY.KILOBYTE_BYTES).toFixed(
      FILE_SIZE_DISPLAY.FRACTION_DIGITS,
    )} ${FILESYSTEM_COPY.KILOBYTE_UNIT}`;
  }
  return `${(size / FILE_SIZE_DISPLAY.MEGABYTE_BYTES).toFixed(
    FILE_SIZE_DISPLAY.FRACTION_DIGITS,
  )} ${FILESYSTEM_COPY.MEGABYTE_UNIT}`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
