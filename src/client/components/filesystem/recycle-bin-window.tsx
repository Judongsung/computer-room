import { useCallback, useEffect, useState } from "react";
import { KOREA_LOCALE } from "../../../constants/date";
import {
  FILESYSTEM_ROOT_ID,
} from "../../../constants/filesystem";
import type {
  FilesystemTrashPage,
  TrashedFilesystemEntry,
} from "../../../types/filesystem";
import {
  FILESYSTEM_COPY,
  FILESYSTEM_DRAG_SOURCE,
} from "../../constants/filesystem";
import { SYSTEM_APP_ID } from "../../constants/system-app";
import type {
  FilesystemGateway,
  FilesystemWindowSyncProps,
} from "../../types/filesystem";
import type { SystemWindowChromeProps } from "../../types/system-app";
import { SystemAppWindow } from "../desktop/system-app-window";
import { ConfirmDialog } from "./filesystem-dialogs";
import { writeFilesystemDragPayload } from "../../domain/filesystem-drag";
import { FilesystemEntryIcon } from "./filesystem-entry-icon";

type RecycleDialog = "delete" | "empty" | null;

interface RecycleBinWindowProps
  extends SystemWindowChromeProps,
    FilesystemWindowSyncProps {
  readonly gateway: FilesystemGateway;
  readonly desktopCapacity: number;
}

export function RecycleBinWindow({
  gateway,
  desktopCapacity,
  filesystemRevision,
  onFilesystemChanged,
  ...chrome
}: RecycleBinWindowProps) {
  const [page, setPage] = useState<FilesystemTrashPage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<RecycleDialog>(null);

  useEffect(() => {
    let active = true;
    setPage(null);
    setSelectedId(null);
    setError(null);
    void gateway
      .listTrash()
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [filesystemRevision, gateway]);

  const selected = page?.items.find((item) => item.entry.id === selectedId) ?? null;
  const runChange = useCallback(async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      setDialog(null);
      setSelectedId(null);
      onFilesystemChanged();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }, [onFilesystemChanged]);
  const loadMore = (): void => {
    if (!page || page.nextOffset === null || busy) return;
    setBusy(true);
    setError(null);
    void gateway
      .listTrash(page.nextOffset)
      .then((next) => {
        setPage((current) =>
          current
            ? {
                items: [...current.items, ...next.items],
                nextOffset: next.nextOffset,
              }
            : current,
        );
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setBusy(false));
  };

  const toolbar = (
    <div
      className="explorer-toolbar"
      aria-label={FILESYSTEM_COPY.RECYCLE_BIN_TOOLBAR}
    >
      <button
        type="button"
        disabled={!selected || busy}
        onClick={() =>
          selected &&
          void runChange(() =>
            gateway.restoreEntry(selected.entry.id, {
              ...(selected.originalParentId === FILESYSTEM_ROOT_ID.DESKTOP
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
      >
        {FILESYSTEM_COPY.RESTORE}
      </button>
      <button type="button" disabled={!selected || busy} onClick={() => setDialog("delete")}>
        {FILESYSTEM_COPY.PERMANENT_DELETE}
      </button>
      <button
        type="button"
        disabled={!page || page.items.length === 0 || busy}
        onClick={() => setDialog("empty")}
      >
        {FILESYSTEM_COPY.EMPTY_RECYCLE_BIN}
      </button>
    </div>
  );

  return (
    <SystemAppWindow
      {...chrome}
      appId={SYSTEM_APP_ID.RECYCLE_BIN}
      toolbar={toolbar}
      bodyClassName="explorer-window__body"
      footer={
        <footer className="explorer-statusbar">
          {selected ? FILESYSTEM_COPY.SELECTED : `${page?.items.length ?? 0}${FILESYSTEM_COPY.ITEM_COUNT_SUFFIX}`}
        </footer>
      }
    >
      {error ? <p className="explorer-message" role="alert">{error}</p> : null}
      {!page && !error ? <p className="explorer-message">{FILESYSTEM_COPY.BUSY}</p> : null}
      {page ? (
        <div className="recycle-list">
          <div className="recycle-list__header" aria-hidden="true">
            <span>{FILESYSTEM_COPY.NAME}</span>
            <span>{FILESYSTEM_COPY.ORIGINAL_LOCATION}</span>
            <span>{FILESYSTEM_COPY.DELETED_AT}</span>
          </div>
          {page.items.map((item) => (
            <RecycleRow
              key={item.entry.id}
              item={item}
              selected={item.entry.id === selectedId}
              thumbnailUrl={(id) => gateway.thumbnailUrl(id)}
              onSelect={() => setSelectedId(item.entry.id)}
            />
          ))}
          {page.items.length === 0 ? <p className="explorer-empty">{FILESYSTEM_COPY.EMPTY_TRASH}</p> : null}
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
      {dialog === "delete" && selected ? (
        <ConfirmDialog
          title={FILESYSTEM_COPY.PERMANENT_DELETE}
          message={FILESYSTEM_COPY.PERMANENT_DELETE_CONFIRM}
          busy={busy}
          onConfirm={() => void runChange(() => gateway.permanentlyDeleteEntry(selected.entry.id))}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === "empty" ? (
        <ConfirmDialog
          title={FILESYSTEM_COPY.EMPTY_RECYCLE_BIN}
          message={FILESYSTEM_COPY.EMPTY_RECYCLE_BIN_CONFIRM}
          busy={busy}
          onConfirm={() => void runChange(() => gateway.emptyTrash())}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </SystemAppWindow>
  );
}

function RecycleRow({
  item,
  selected,
  thumbnailUrl,
  onSelect,
}: {
  readonly item: TrashedFilesystemEntry;
  readonly selected: boolean;
  readonly thumbnailUrl: (id: string) => string;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      className={selected ? "recycle-list__row recycle-list__row--selected" : "recycle-list__row"}
      onClick={onSelect}
      onDragStart={(event) =>
        writeFilesystemDragPayload(event.dataTransfer, {
          id: item.entry.id,
          source: FILESYSTEM_DRAG_SOURCE.TRASH,
        })
      }
    >
      <span>
        <FilesystemEntryIcon
          entry={item.entry}
          thumbnailUrl={thumbnailUrl}
        />
        {item.entry.name}
      </span>
      <span>{item.originalLocation}</span>
      <time dateTime={item.deletedAt}>
        {new Date(item.deletedAt).toLocaleString(KOREA_LOCALE)}
      </time>
    </button>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : FILESYSTEM_COPY.CHANGE_FAILED;
}
