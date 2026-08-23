import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "../../../constants/filesystem";
import {
  isPotentialMediaContentType,
  mediaKindFromContentType,
} from "../../../domain/media-type";
import {
  FILE_PICKER_ABORT_ERROR_NAME,
  FILESYSTEM_DRAG_SOURCE,
  FILE_SIZE_DISPLAY,
  FILESYSTEM_COPY,
} from "../../constants/filesystem";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID,
} from "../../constants/system-app";
import { MEDIA_VIEWER_COPY } from "../../constants/media";
import { KEYBOARD_KEY } from "../../constants/keyboard";
import type {
  FilesystemDirectoryPage,
  FilesystemEntry,
} from "../../../types/filesystem";
import type { LocalUploadNode } from "../../types/upload";
import type {
  FilesystemGateway,
  FilesystemWindowSyncProps,
} from "../../types/filesystem";
import type { DesktopAppWindowProps } from "../../types/desktop";
import type { MediaViewerOpenRequest } from "../../types/media";
import { downloadFile } from "../../utils/download-file";
import {
  collectDroppedUploadNodes,
  collectSelectedUploadNodes,
  selectDirectoryUploadNode,
  supportsDirectoryHandlePicker,
} from "../../domain/local-file-tree";
import {
  readFilesystemDragPayload,
  writeFilesystemDragPayload,
} from "../../domain/filesystem-drag";
import { DesktopAppWindow } from "../desktop/desktop-app-window";
import {
  DirectoryPickerDialog,
  ConfirmDialog,
  NameDialog,
} from "./filesystem-dialogs";
import { FilesystemEntryIcon } from "./filesystem-entry-icon";

type DocumentsDialog = "create" | "rename" | "move" | null;

interface DocumentsWindowProps
  extends Omit<
      DesktopAppWindowProps,
      | "title"
      | "iconPath"
      | "minWidth"
      | "minHeight"
      | "toolbar"
      | "footer"
      | "bodyClassName"
      | "children"
    >,
    FilesystemWindowSyncProps {
  readonly gateway: FilesystemGateway;
  readonly windowId: string;
  readonly title: string;
  readonly iconPath: string;
  readonly onOpenMedia: (request: MediaViewerOpenRequest) => void;
  readonly initialDirectoryId: string;
  readonly onDirectoryChanged: (
    windowId: string,
    directoryId: string,
    title: string,
  ) => void;
  readonly onOpenWidget: (widgetId: string) => void;
  readonly onEntryChanged: (entry: FilesystemEntry) => void;
  readonly onWidgetsClosed: (widgetIds: readonly string[]) => void;
  readonly onUploadNodes: (
    nodes: readonly LocalUploadNode[],
    parentId: string,
    notice?: string | null,
  ) => Promise<void>;
  readonly desktopCapacity: number;
}

export function DocumentsWindow({
  gateway,
  windowId,
  title,
  iconPath,
  onOpenMedia,
  initialDirectoryId,
  onDirectoryChanged,
  onOpenWidget,
  onEntryChanged,
  onWidgetsClosed,
  onUploadNodes,
  desktopCapacity,
  filesystemRevision,
  onFilesystemChanged,
  ...chrome
}: DocumentsWindowProps) {
  const [directoryId, setDirectoryId] = useState(initialDirectoryId);
  const [history, setHistory] = useState<readonly string[]>([]);
  const [page, setPage] = useState<FilesystemDirectoryPage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<DocumentsDialog>(null);
  const [unsupportedMedia, setUnsupportedMedia] = useState<FilesystemEntry | null>(
    null,
  );
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setPage(null);
    setSelectedId(null);
    setError(null);
    void gateway
      .listDirectory(directoryId)
      .then((value) => {
        if (active) {
          setPage(value);
          onDirectoryChanged(
            windowId,
            value.directory.id,
            value.directory.name,
          );
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason, FILESYSTEM_COPY.LOAD_FAILED));
      });
    return () => {
      active = false;
    };
  }, [
    directoryId,
    filesystemRevision,
    gateway,
    onDirectoryChanged,
    windowId,
  ]);

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
    if (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET) {
      onOpenWidget(entry.widgetId);
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
    const files = event.target.files;
    event.target.value = "";
    if (files && files.length > 0 && currentDirectoryId) {
      void onUploadNodes(
        collectSelectedUploadNodes(files),
        currentDirectoryId,
      );
    }
  };
  const selectFolder = (): void => {
    if (!currentDirectoryId) return;
    if (!supportsDirectoryHandlePicker()) {
      folderInputRef.current?.click();
      return;
    }
    void selectDirectoryUploadNode()
      .then((node) => {
        if (node) {
          return onUploadNodes([node], currentDirectoryId);
        }
        folderInputRef.current?.click();
        return undefined;
      })
      .catch((reason: unknown) => {
        if (!isPickerCancellation(reason)) {
          setError(errorMessage(reason, FILESYSTEM_COPY.CHANGE_FAILED));
        }
      });
  };

  const dropIntoDirectory = (
    event: DragEvent,
    parentId: string,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    setDropTargetId(null);
    const payload = readFilesystemDragPayload(event.dataTransfer);
    if (payload) {
      void runChange(async () => {
        if (payload.source === FILESYSTEM_DRAG_SOURCE.TRASH) {
          const entry = await gateway.restoreEntry(payload.id, {
            parentId,
            ...(parentId === FILESYSTEM_ROOT_ID.DESKTOP
              ? {
                  desktopPlacement: {
                    targetIndex: 0,
                    capacity: desktopCapacity,
                  },
                }
              : {}),
          });
          onEntryChanged(entry);
        } else {
          const entry = await gateway.moveEntry(payload.id, {
            parentId,
            ...(parentId === FILESYSTEM_ROOT_ID.DESKTOP
              ? {
                  desktopPlacement: {
                    targetIndex: 0,
                    capacity: desktopCapacity,
                  },
                }
              : {}),
          });
          onEntryChanged(entry);
        }
      });
      return;
    }
    void collectDroppedUploadNodes(event.dataTransfer.items)
      .then((selection) =>
        onUploadNodes(
          selection.nodes,
          parentId,
          selection.folderDropUnsupported
            ? FILESYSTEM_COPY.FOLDER_DROP_UNSUPPORTED
            : null,
        ),
      )
      .catch((reason: unknown) =>
        setError(errorMessage(reason, FILESYSTEM_COPY.CHANGE_FAILED)),
      );
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
        {FILESYSTEM_COPY.UPLOAD_FILES}
      </button>
      <button type="button" disabled={!currentDirectoryId || busy} onClick={selectFolder}>
        {FILESYSTEM_COPY.UPLOAD_FOLDER}
      </button>
      <input ref={fileInputRef} className="visually-hidden" type="file" multiple onChange={upload} />
      <input
        ref={folderInputRef}
        className="visually-hidden"
        type="file"
        multiple
        {...{ webkitdirectory: "" }}
        onChange={upload}
      />
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
        onClick={() => selected && void runChange(async () => {
          const result = await gateway.trashEntry(selected.id);
          onWidgetsClosed(result.closedWidgetIds);
        })}
      >
        {FILESYSTEM_COPY.DELETE}
      </button>
    </div>
  );

  return (
    <DesktopAppWindow
      {...chrome}
      title={title}
      iconPath={iconPath}
      minWidth={SYSTEM_APP_CONFIG[SYSTEM_APP_ID.DOCUMENTS].minWidth}
      minHeight={SYSTEM_APP_CONFIG[SYSTEM_APP_ID.DOCUMENTS].minHeight}
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
              <button
                type="button"
                onClick={() => setDirectoryId(item.id)}
                data-drop-target={dropTargetId === item.id}
                onDragEnter={(event) => {
                  event.stopPropagation();
                  setDropTargetId(item.id);
                }}
                onDragLeave={() => setDropTargetId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropIntoDirectory(event, item.id)}
              >
                {item.name}
              </button>
            </span>
          ))}
        </div>
      </div>
      {error ? <p className="explorer-message" role="alert">{error}</p> : null}
      {!page && !error ? <p className="explorer-message">{FILESYSTEM_COPY.BUSY}</p> : null}
      {page ? (
        <div
          className="explorer-content"
          data-drop-target={dropTargetId === currentDirectoryId}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedId(null);
          }}
          onDragEnter={(event) => {
            if (event.target === event.currentTarget && currentDirectoryId) {
              setDropTargetId(currentDirectoryId);
            }
          }}
          onDragLeave={(event) => {
            if (event.target === event.currentTarget) setDropTargetId(null);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) =>
            currentDirectoryId && dropIntoDirectory(event, currentDirectoryId)
          }
        >
          {page.items.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === selectedId ? "explorer-item explorer-item--selected" : "explorer-item"}
              data-drop-target={dropTargetId === entry.id}
              draggable
              onClick={() => setSelectedId(entry.id)}
              onDoubleClick={() => openEntry(entry)}
              onDragStart={(event) =>
                writeFilesystemDragPayload(event.dataTransfer, {
                  id: entry.id,
                  source: FILESYSTEM_DRAG_SOURCE.ACTIVE,
                })
              }
              onDragOver={(event) => {
                if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
                  event.preventDefault();
                }
              }}
              onDragEnter={(event) => {
                if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
                  event.stopPropagation();
                  setDropTargetId(entry.id);
                }
              }}
              onDragLeave={() => {
                if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
                  setDropTargetId(null);
                }
              }}
              onDrop={(event) => {
                if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
                  dropIntoDirectory(event, entry.id);
                }
              }}
              onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                if (event.key === KEYBOARD_KEY.ENTER) openEntry(entry);
              }}
            >
              <FilesystemEntryIcon
                entry={entry}
                thumbnailUrl={(id) => gateway.thumbnailUrl(id)}
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
          onSubmit={(name) =>
            void runChange(async () => {
              onEntryChanged(
                await gateway.updateEntry(selected.id, { name }),
              );
            })
          }
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === "move" && selected ? (
        <DirectoryPickerDialog
          gateway={gateway}
          excludedEntryId={selected.id}
          busy={busy}
          onSelect={(parentId) =>
            void runChange(async () => {
              onEntryChanged(
                await gateway.moveEntry(selected.id, {
                  parentId,
                  ...(parentId === FILESYSTEM_ROOT_ID.DESKTOP
                    ? {
                        desktopPlacement: {
                          targetIndex: 0,
                          capacity: desktopCapacity,
                        },
                      }
                    : {}),
                }),
              );
            })
          }
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
    </DesktopAppWindow>
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

function isPickerCancellation(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    error.name === FILE_PICKER_ABORT_ERROR_NAME
  );
}
