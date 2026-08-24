import {
  useCallback,
  useEffect,
  useMemo,
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
import { FILESYSTEM_SORT_DIRECTION_VALUES } from "../../../constants/filesystem-sort";
import {
  isFilesystemSortDirection,
  isFilesystemSortField,
} from "../../../domain/filesystem-sort";
import {
  isPotentialMediaContentType,
  mediaKindFromContentType,
} from "../../../domain/media-type";
import {
  FILE_PICKER_ABORT_ERROR_NAME,
  FILESYSTEM_DRAG_SOURCE,
  FILESYSTEM_COPY,
  FILESYSTEM_SELECTION_DATA_ATTRIBUTE,
} from "../../constants/filesystem";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID,
} from "../../constants/system-app";
import { MEDIA_VIEWER_COPY } from "../../constants/media";
import { KEYBOARD_KEY } from "../../constants/keyboard";
import type {
  FilesystemDirectorySort,
  FilesystemDirectoryPage,
  FilesystemEntry,
} from "../../../types/filesystem";
import type { FilesystemBatchResult } from "../../../types/filesystem-batch";
import type { LocalUploadNode } from "../../types/upload";
import type {
  FilesystemGateway,
  FilesystemWindowSyncProps,
} from "../../types/filesystem";
import type { DesktopAppWindowProps } from "../../types/desktop";
import type { MediaViewerOpenRequest } from "../../types/media";
import { downloadFile } from "../../utils/download-file";
import { formatFileSize } from "../../utils/format-file-size";
import { useFilesystemSelection } from "../../hooks/use-filesystem-selection";
import { useFilesystemMarqueeSelection } from "../../hooks/use-filesystem-marquee-selection";
import { useFilesystemDownload } from "../../hooks/use-filesystem-download";
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
import { FilesystemSelectionMarquee } from "./filesystem-selection-marquee";
import { FilesystemBatchResultDialog } from "./filesystem-batch-result-dialog";
import { DownloadTransferDialog } from "./download-transfer-dialog";
import { useXpContextMenu } from "../../state/context-menu-context";
import { contextMenuCommand, contextMenuSeparator } from "../../domain/context-menu";
import { XP_CONTEXT_MENU_COMMAND_ID } from "../../constants/context-menu";
import {
  FILESYSTEM_SORT_CLASS_NAME,
  FILESYSTEM_SORT_COPY,
  FILESYSTEM_SORT_DIRECTION_LABELS,
  FILESYSTEM_SORT_FIELD_OPTIONS,
} from "../../constants/filesystem-sort";

type DocumentsDialog = "create" | "rename" | "move" | null;
const EMPTY_ENTRY_IDS: readonly string[] = [];

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
  const contextMenu = useXpContextMenu();
  const [directoryId, setDirectoryId] = useState(initialDirectoryId);
  const [history, setHistory] = useState<readonly string[]>([]);
  const [page, setPage] = useState<FilesystemDirectoryPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<DocumentsDialog>(null);
  const [unsupportedMedia, setUnsupportedMedia] = useState<FilesystemEntry | null>(
    null,
  );
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<FilesystemBatchResult | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const itemIds = useMemo(
    () => page?.items.map((item) => item.id) ?? EMPTY_ENTRY_IDS,
    [page?.items],
  );
  const selection = useFilesystemSelection(itemIds);
  const marquee = useFilesystemMarqueeSelection(
    contentRef,
    selection.selectedIds,
    selection.replace,
  );
  const download = useFilesystemDownload(gateway);

  useEffect(() => {
    let active = true;
    setPage(null);
    selection.clear();
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
    selection.clear,
    windowId,
  ]);

  const selectedEntries = useMemo(
    () =>
      page?.items.filter((item) => selection.selectedIds.has(item.id)) ?? [],
    [page?.items, selection.selectedIds],
  );
  const selected =
    selectedEntries.length === 1 ? selectedEntries[0] ?? null : null;
  const currentDirectoryId = page?.directory.id;
  const runChange = useCallback(
    async (operation: () => Promise<unknown>): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        await operation();
        setDialog(null);
        selection.clear();
        onFilesystemChanged();
      } catch (reason) {
        setError(errorMessage(reason, FILESYSTEM_COPY.CHANGE_FAILED));
      } finally {
        setBusy(false);
      }
    },
    [onFilesystemChanged, selection.clear],
  );

  const runBatchChange = useCallback(
    async (operation: () => Promise<FilesystemBatchResult>): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        const result = await operation();
        result.entries.forEach(onEntryChanged);
        onWidgetsClosed(result.closedWidgetIds);
        setDialog(null);
        setBatchResult(result.failures.length > 0 ? result : null);
        selection.replace(result.failures.map((failure) => failure.id));
        onFilesystemChanged();
      } catch (reason) {
        setError(errorMessage(reason, FILESYSTEM_COPY.CHANGE_FAILED));
      } finally {
        setBusy(false);
      }
    },
    [
      onEntryChanged,
      onFilesystemChanged,
      onWidgetsClosed,
      selection.replace,
    ],
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
  const changeSort = (sort: FilesystemDirectorySort): void => {
    if (!currentDirectoryId || busy) return;
    void runChange(async () => {
      await gateway.updateDirectorySort(currentDirectoryId, sort);
      if (contentRef.current) contentRef.current.scrollTop = 0;
    });
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
      void runBatchChange(async () => {
        if (payload.source === FILESYSTEM_DRAG_SOURCE.TRASH) {
          return gateway.restoreEntries(payload.ids, {
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
        }
        return gateway.moveEntries(payload.ids, {
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

  const openEntryContextMenu = (
    entry: FilesystemEntry,
    event: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number },
  ): void => {
    const entries = selection.selectedIds.has(entry.id)
      ? selectedEntries
      : [entry];
    if (!selection.selectedIds.has(entry.id)) selection.replace([entry.id]);
    contextMenu.openFromEvent(event, [
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.OPEN,
        FILESYSTEM_COPY.OPEN,
        () => openEntry(entries[0] ?? entry),
        entries.length !== 1,
      ),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.DOWNLOAD,
        FILESYSTEM_COPY.DOWNLOAD,
        () => download.start(entries),
        entries.every((candidate) => candidate.kind === FILESYSTEM_ENTRY_KIND.WIDGET),
      ),
      contextMenuSeparator("explorer-entry-separator-1"),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.RENAME,
        FILESYSTEM_COPY.RENAME,
        () => setDialog("rename"),
        entries.length !== 1,
      ),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.MOVE,
        FILESYSTEM_COPY.MOVE,
        () => setDialog("move"),
      ),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.TRASH,
        FILESYSTEM_COPY.DELETE,
        () => runBatchChange(() => gateway.trashEntries(entries.map((candidate) => candidate.id))),
      ),
    ]);
  };

  const openDirectoryContextMenu = (
    event: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number },
  ): void => {
    contextMenu.openFromEvent(event, [
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.NEW_FOLDER,
        FILESYSTEM_COPY.NEW_FOLDER,
        () => setDialog("create"),
        !currentDirectoryId || busy,
      ),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.UPLOAD_FILES,
        FILESYSTEM_COPY.UPLOAD_FILES,
        () => fileInputRef.current?.click(),
        !currentDirectoryId || busy,
      ),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.UPLOAD_FOLDER,
        FILESYSTEM_COPY.UPLOAD_FOLDER,
        selectFolder,
        !currentDirectoryId || busy,
      ),
      contextMenuSeparator("explorer-directory-separator-1"),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.REFRESH,
        FILESYSTEM_COPY.REFRESH,
        onFilesystemChanged,
      ),
    ]);
  };

  const sortControls = (
    <div
      className={FILESYSTEM_SORT_CLASS_NAME.BAR}
      role="group"
      aria-label={FILESYSTEM_SORT_COPY.GROUP_LABEL}
    >
      <label className={FILESYSTEM_SORT_CLASS_NAME.CONTROL}>
        <span className={FILESYSTEM_SORT_CLASS_NAME.LABEL}>
          {FILESYSTEM_SORT_COPY.FIELD_LABEL}
        </span>
        <select
          aria-label={FILESYSTEM_SORT_COPY.FIELD_LABEL}
          disabled={!page || busy}
          value={page?.sort.field ?? ""}
          onChange={(event) => {
            if (!page || !isFilesystemSortField(event.target.value)) return;
            changeSort({
              field: event.target.value,
              direction: page.sort.direction,
            });
          }}
        >
          {FILESYSTEM_SORT_FIELD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className={FILESYSTEM_SORT_CLASS_NAME.CONTROL}>
        <span className={FILESYSTEM_SORT_CLASS_NAME.LABEL}>
          {FILESYSTEM_SORT_COPY.DIRECTION_LABEL}
        </span>
        <select
          aria-label={FILESYSTEM_SORT_COPY.DIRECTION_LABEL}
          disabled={!page || busy}
          value={page?.sort.direction ?? ""}
          onChange={(event) => {
            if (!page || !isFilesystemSortDirection(event.target.value)) {
              return;
            }
            changeSort({
              field: page.sort.field,
              direction: event.target.value,
            });
          }}
        >
          {FILESYSTEM_SORT_DIRECTION_VALUES.map((direction) => (
            <option key={direction} value={direction}>
              {page
                ? FILESYSTEM_SORT_DIRECTION_LABELS[page.sort.field][direction]
                : direction}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

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
        disabled={
          selectedEntries.length === 0 ||
          selectedEntries.every(
            (entry) => entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET,
          ) ||
          busy
        }
        onClick={() => void download.start(selectedEntries)}
      >
        {FILESYSTEM_COPY.DOWNLOAD}
      </button>
      <button type="button" disabled={!selected || busy} onClick={() => setDialog("rename")}>
        {FILESYSTEM_COPY.RENAME}
      </button>
      <button type="button" disabled={selectedEntries.length === 0 || busy} onClick={() => setDialog("move")}>
        {FILESYSTEM_COPY.MOVE}
      </button>
      <button
        type="button"
        disabled={selectedEntries.length === 0 || busy}
        onClick={() =>
          void runBatchChange(() =>
            gateway.trashEntries(selection.selectedInOrder),
          )
        }
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
          {selectedEntries.length > 0
            ? FILESYSTEM_COPY.SELECTED_COUNT(selectedEntries.length)
            : `${page?.items.length ?? 0}${FILESYSTEM_COPY.ITEM_COUNT_SUFFIX}`}
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
      {sortControls}
      {error ? <p className="explorer-message" role="alert">{error}</p> : null}
      {!page && !error ? <p className="explorer-message">{FILESYSTEM_COPY.BUSY}</p> : null}
      {page ? (
        <div
          ref={contentRef}
          className="explorer-content"
          data-drop-target={dropTargetId === currentDirectoryId}
          onPointerDown={marquee.onPointerDown}
          onPointerMove={marquee.onPointerMove}
          onPointerUp={marquee.onPointerUp}
          onPointerCancel={marquee.onPointerCancel}
          onKeyDown={(event) => {
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key.toLocaleLowerCase() === KEYBOARD_KEY.A
            ) {
              event.preventDefault();
              selection.selectAll();
            } else if (event.key === KEYBOARD_KEY.ESCAPE) {
              selection.clear();
            }
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
          onContextMenu={openDirectoryContextMenu}
        >
          {page.items.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={selection.selectedIds.has(entry.id) ? "explorer-item explorer-item--selected" : "explorer-item"}
              {...{ [FILESYSTEM_SELECTION_DATA_ATTRIBUTE]: entry.id }}
              data-drop-target={dropTargetId === entry.id}
              draggable
              onClick={(event) => selection.select(entry.id, event)}
              onDoubleClick={() => openEntry(entry)}
              onContextMenu={(event) => openEntryContextMenu(entry, event)}
              onDragStart={(event) => {
                const ids = selection.dragIds(entry.id);
                selection.replace(ids);
                writeFilesystemDragPayload(event.dataTransfer, {
                  ids,
                  primaryId: entry.id,
                  source: FILESYSTEM_DRAG_SOURCE.ACTIVE,
                });
              }}
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
              {entry.kind === FILESYSTEM_ENTRY_KIND.FILE ? <small>{formatFileSize(entry.size)}</small> : null}
            </button>
          ))}
          <FilesystemSelectionMarquee bounds={marquee.bounds} />
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
      {dialog === "move" && selectedEntries.length > 0 ? (
        <DirectoryPickerDialog
          gateway={gateway}
          excludedEntryIds={selectedEntries
            .filter((entry) => entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY)
            .map((entry) => entry.id)}
          busy={busy}
          onSelect={(parentId) =>
            void runBatchChange(() =>
              gateway.moveEntries(selection.selectedInOrder, {
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
            )
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
      <FilesystemBatchResultDialog
        result={batchResult}
        onClose={() => setBatchResult(null)}
      />
      <DownloadTransferDialog
        state={download.state}
        onCancel={download.cancel}
        onClose={download.close}
      />
    </DesktopAppWindow>
  );
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
