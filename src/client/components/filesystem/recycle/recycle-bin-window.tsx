import type { DragEvent, MouseEvent } from "react";
import { KOREA_LOCALE } from "@/constants/platform/date";
import type { TrashedFilesystemEntry } from "@/types/filesystem/filesystem";
import {
  FILESYSTEM_COPY,
  FILESYSTEM_DRAG_SOURCE,
  FILESYSTEM_SELECTION_DATA_ATTRIBUTE,
} from "@client/constants/filesystem/filesystem";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import { SystemAppWindow } from "@client/components/desktop/system-app-window";
import { ConfirmDialog } from "@client/components/filesystem/filesystem-dialogs";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";
import { FilesystemBatchResultDialog } from "@client/components/filesystem/filesystem-batch-result-dialog";
import { FilesystemSelectionMarquee } from "@client/components/filesystem/filesystem-selection-marquee";
import { writeFilesystemDragPayload } from "@client/domain/filesystem/drag";
import { useRecycleBinController } from "@client/hooks/filesystem/recycle/use-recycle-bin-controller";
import type { RecycleBinWindowProps } from "@client/types/filesystem/recycle-bin";

export function RecycleBinWindow({
  gateway,
  desktopCapacity,
  filesystemRevision,
  onFilesystemChanged,
  ...chrome
}: RecycleBinWindowProps) {
  const controller = useRecycleBinController({
    gateway,
    desktopCapacity,
    filesystemRevision,
    onFilesystemChanged,
  });
  const { page, selectedItems, selection } = controller;
  const toolbar = (
    <div className="explorer-toolbar" aria-label={FILESYSTEM_COPY.RECYCLE_BIN_TOOLBAR}>
      <button
        type="button"
        disabled={selectedItems.length === 0 || controller.busy}
        onClick={() => void controller.restore(selection.selectedInOrder)}
      >
        {FILESYSTEM_COPY.RESTORE}
      </button>
      <button
        type="button"
        disabled={selectedItems.length === 0 || controller.busy}
        onClick={() => controller.setDialog("delete")}
      >
        {FILESYSTEM_COPY.PERMANENT_DELETE}
      </button>
      <button
        type="button"
        disabled={!page || page.items.length === 0 || controller.busy}
        onClick={() => controller.setDialog("empty")}
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
          {selectedItems.length > 0
            ? FILESYSTEM_COPY.SELECTED_COUNT(selectedItems.length)
            : `${page?.items.length ?? 0}${FILESYSTEM_COPY.ITEM_COUNT_SUFFIX}`}
        </footer>
      }
    >
      {controller.error ? <p className="explorer-message" role="alert">{controller.error}</p> : null}
      {!page && !controller.error ? <p className="explorer-message">{FILESYSTEM_COPY.BUSY}</p> : null}
      {page ? (
        <div
          ref={controller.listRef}
          className="recycle-list"
          onPointerDown={controller.marquee.onPointerDown}
          onPointerMove={controller.marquee.onPointerMove}
          onPointerUp={controller.marquee.onPointerUp}
          onPointerCancel={controller.marquee.onPointerCancel}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === KEYBOARD_KEY.A) {
              event.preventDefault();
              selection.selectAll();
            } else if (event.key === KEYBOARD_KEY.ESCAPE) {
              selection.clear();
            }
          }}
          onContextMenu={controller.openContextMenu}
        >
          <div className="recycle-list__header" aria-hidden="true">
            <span>{FILESYSTEM_COPY.NAME}</span>
            <span>{FILESYSTEM_COPY.ORIGINAL_LOCATION}</span>
            <span>{FILESYSTEM_COPY.DELETED_AT}</span>
          </div>
          {page.items.map((item) => (
            <RecycleRow
              key={item.entry.id}
              item={item}
              selected={selection.selectedIds.has(item.entry.id)}
              thumbnailUrl={gateway.thumbnailUrl.bind(gateway)}
              onSelect={(event) => selection.select(item.entry.id, event)}
              onDragStart={(event) => {
                const ids = selection.dragIds(item.entry.id);
                selection.replace(ids);
                writeFilesystemDragPayload(event.dataTransfer, {
                  ids,
                  primaryId: item.entry.id,
                  source: FILESYSTEM_DRAG_SOURCE.TRASH,
                });
              }}
              onContextMenu={(event) => controller.openItemContextMenu(item, event)}
            />
          ))}
          <FilesystemSelectionMarquee bounds={controller.marquee.bounds} />
          {page.items.length === 0 ? <p className="explorer-empty">{FILESYSTEM_COPY.EMPTY_TRASH}</p> : null}
          {page.nextOffset !== null ? (
            <button
              type="button"
              className="explorer-load-more"
              disabled={controller.busy}
              onClick={() => void controller.loadMore()}
            >
              {FILESYSTEM_COPY.LOAD_MORE}
            </button>
          ) : null}
        </div>
      ) : null}
      {controller.dialog === "delete" && selectedItems.length > 0 ? (
        <ConfirmDialog
          title={FILESYSTEM_COPY.PERMANENT_DELETE}
          message={FILESYSTEM_COPY.PERMANENT_DELETE_CONFIRM}
          busy={controller.busy}
          onConfirm={() =>
            void controller.runBatchChange(() =>
              gateway.permanentlyDeleteEntries(selection.selectedInOrder),
            )
          }
          onCancel={() => controller.setDialog(null)}
        />
      ) : null}
      {controller.dialog === "empty" ? (
        <ConfirmDialog
          title={FILESYSTEM_COPY.EMPTY_RECYCLE_BIN}
          message={FILESYSTEM_COPY.EMPTY_RECYCLE_BIN_CONFIRM}
          busy={controller.busy}
          onConfirm={() => void controller.runChange(() => gateway.emptyTrash())}
          onCancel={() => controller.setDialog(null)}
        />
      ) : null}
      <FilesystemBatchResultDialog
        result={controller.batchResult}
        onClose={() => controller.setBatchResult(null)}
      />
    </SystemAppWindow>
  );
}

function RecycleRow({
  item,
  selected,
  thumbnailUrl,
  onSelect,
  onDragStart,
  onContextMenu,
}: {
  readonly item: TrashedFilesystemEntry;
  readonly selected: boolean;
  readonly thumbnailUrl: (id: string) => string;
  readonly onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  readonly onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      draggable
      className={selected ? "recycle-list__row recycle-list__row--selected" : "recycle-list__row"}
      {...{ [FILESYSTEM_SELECTION_DATA_ATTRIBUTE]: item.entry.id }}
      onClick={onSelect}
      onDragStart={onDragStart}
      onContextMenu={onContextMenu}
    >
      <span>
        <FilesystemEntryIcon entry={item.entry} thumbnailUrl={thumbnailUrl} />
        {item.entry.name}
      </span>
      <span>{item.originalLocation}</span>
      <time dateTime={item.deletedAt}>{new Date(item.deletedAt).toLocaleString(KOREA_LOCALE)}</time>
    </button>
  );
}
