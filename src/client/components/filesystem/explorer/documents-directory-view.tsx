import type { DragEvent, KeyboardEvent, MouseEvent, RefObject } from "react";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type {
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";
import {
  FILESYSTEM_COPY,
  FILESYSTEM_DRAG_SOURCE,
  FILESYSTEM_SELECTION_DATA_ATTRIBUTE,
} from "@client/constants/filesystem/filesystem";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { writeFilesystemDragPayload } from "@client/domain/filesystem/drag";
import { DirectorySortControls } from "@client/components/filesystem/directory-sort-controls";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";
import { FilesystemSelectionMarquee } from "@client/components/filesystem/filesystem-selection-marquee";
import type { useFilesystemMarqueeSelection } from "@client/hooks/filesystem/use-filesystem-marquee-selection";
import type { useFilesystemSelection } from "@client/hooks/filesystem/use-filesystem-selection";
import { formatFileSize } from "@client/utils/format-file-size";

interface DocumentsDirectoryViewProps {
  readonly page: FilesystemDirectoryPage;
  readonly busy: boolean;
  readonly currentDirectoryId: string;
  readonly dropTargetId: string | null;
  readonly contentRef: RefObject<HTMLDivElement | null>;
  readonly selection: ReturnType<typeof useFilesystemSelection>;
  readonly marquee: ReturnType<typeof useFilesystemMarqueeSelection>;
  readonly selectedDirectory: Extract<FilesystemEntry, { readonly kind: "directory" }> | null;
  readonly thumbnailUrl: (id: string) => string;
  readonly onNavigateDirect: (directoryId: string) => void;
  readonly onChangeSort: (sort: FilesystemDirectorySort) => void;
  readonly onOpenEntry: (entry: FilesystemEntry) => void;
  readonly onShowProperties: (entry: Extract<FilesystemEntry, { readonly kind: "directory" }>) => void;
  readonly onDropTargetChange: (id: string | null) => void;
  readonly onDropIntoDirectory: (event: DragEvent, parentId: string) => void;
  readonly onEntryContextMenu: (entry: FilesystemEntry, event: MouseEvent<HTMLButtonElement>) => void;
  readonly onDirectoryContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
  readonly onLoadMore: () => void;
}

export function DocumentsDirectoryView({
  page,
  busy,
  currentDirectoryId,
  dropTargetId,
  contentRef,
  selection,
  marquee,
  selectedDirectory,
  thumbnailUrl,
  onNavigateDirect,
  onChangeSort,
  onOpenEntry,
  onShowProperties,
  onDropTargetChange,
  onDropIntoDirectory,
  onEntryContextMenu,
  onDirectoryContextMenu,
  onLoadMore,
}: DocumentsDirectoryViewProps) {
  return (
    <>
      <div className="explorer-address">
        <span>{FILESYSTEM_COPY.ADDRESS}</span>
        <div>
          {page.breadcrumbs.map((item, index) => (
            <span key={item.id}>
              {index > 0 ? " › " : ""}
              <button
                type="button"
                onClick={() => onNavigateDirect(item.id)}
                data-drop-target={dropTargetId === item.id}
                onDragEnter={(event) => {
                  event.stopPropagation();
                  onDropTargetChange(item.id);
                }}
                onDragLeave={() => onDropTargetChange(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDropIntoDirectory(event, item.id)}
              >
                {item.name}
              </button>
            </span>
          ))}
        </div>
      </div>
      <DirectorySortControls page={page} busy={busy} onChange={onChangeSort} />
      <div
        ref={contentRef}
        className="explorer-content"
        data-drop-target={dropTargetId === currentDirectoryId}
        onPointerDown={marquee.onPointerDown}
        onPointerMove={marquee.onPointerMove}
        onPointerUp={marquee.onPointerUp}
        onPointerCancel={marquee.onPointerCancel}
        onKeyDown={(event) =>
          handleSelectionKeyDown(event, selection, selectedDirectory, onShowProperties)
        }
        onDragEnter={(event) => {
          if (event.target === event.currentTarget) onDropTargetChange(currentDirectoryId);
        }}
        onDragLeave={(event) => {
          if (event.target === event.currentTarget) onDropTargetChange(null);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => onDropIntoDirectory(event, currentDirectoryId)}
        onContextMenu={onDirectoryContextMenu}
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
            onDoubleClick={() => onOpenEntry(entry)}
            onContextMenu={(event) => onEntryContextMenu(entry, event)}
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
              if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) event.preventDefault();
            }}
            onDragEnter={(event) => {
              if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
                event.stopPropagation();
                onDropTargetChange(entry.id);
              }
            }}
            onDragLeave={() => {
              if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) onDropTargetChange(null);
            }}
            onDrop={(event) => {
              if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
                onDropIntoDirectory(event, entry.id);
              }
            }}
            onKeyDown={(event) => {
              if (event.key !== KEYBOARD_KEY.ENTER) return;
              if (event.altKey) {
                event.preventDefault();
                event.stopPropagation();
                if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
                  selection.replace([entry.id]);
                  onShowProperties(entry);
                }
                return;
              }
              onOpenEntry(entry);
            }}
          >
            <FilesystemEntryIcon entry={entry} thumbnailUrl={thumbnailUrl} />
            <span>{entry.name}</span>
            {entry.kind === FILESYSTEM_ENTRY_KIND.FILE ? <small>{formatFileSize(entry.size)}</small> : null}
          </button>
        ))}
        <FilesystemSelectionMarquee bounds={marquee.bounds} />
        {page.items.length === 0 ? <p className="explorer-empty">{FILESYSTEM_COPY.EMPTY_DIRECTORY}</p> : null}
        {page.nextOffset !== null ? (
          <button type="button" className="explorer-load-more" disabled={busy} onClick={onLoadMore}>
            {FILESYSTEM_COPY.LOAD_MORE}
          </button>
        ) : null}
      </div>
    </>
  );
}

function handleSelectionKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  selection: ReturnType<typeof useFilesystemSelection>,
  selectedDirectory: Extract<FilesystemEntry, { readonly kind: "directory" }> | null,
  showProperties: (entry: Extract<FilesystemEntry, { readonly kind: "directory" }>) => void,
): void {
  if (event.altKey && event.key === KEYBOARD_KEY.ENTER && selectedDirectory) {
    event.preventDefault();
    showProperties(selectedDirectory);
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === KEYBOARD_KEY.A) {
    event.preventDefault();
    selection.selectAll();
  } else if (event.key === KEYBOARD_KEY.ESCAPE) {
    selection.clear();
  }
}
