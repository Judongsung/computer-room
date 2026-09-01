import type {
  DragEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEventHandler,
  RefObject,
} from "react";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type {
  FilesystemDirectoryPage,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";
import { FILESYSTEM_SELECTION_DATA_ATTRIBUTE } from "@client/constants/filesystem/filesystem";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";
import { FilesystemSelectionMarquee } from "@client/components/filesystem/filesystem-selection-marquee";
import type { FilesystemMarqueeBounds } from "@client/hooks/filesystem/use-filesystem-marquee-selection";
import { formatFileSize } from "@client/utils/format-file-size";

type DirectoryEntry = Extract<
  FilesystemEntry,
  { readonly kind: typeof FILESYSTEM_ENTRY_KIND.DIRECTORY }
>;

interface ExplorerSelectionCapability {
  readonly selectedIds: ReadonlySet<string>;
  readonly onSelect: (
    id: string,
    event: Pick<MouseEvent<HTMLButtonElement>, "ctrlKey" | "metaKey" | "shiftKey">,
  ) => void;
  readonly onSelectAll?: () => void;
  readonly onClear?: () => void;
}

interface ExplorerMarqueeCapability {
  readonly contentRef: RefObject<HTMLDivElement | null>;
  readonly bounds: FilesystemMarqueeBounds | null;
  readonly onPointerDown: PointerEventHandler<HTMLDivElement>;
  readonly onPointerMove: PointerEventHandler<HTMLDivElement>;
  readonly onPointerUp: PointerEventHandler<HTMLDivElement>;
  readonly onPointerCancel: PointerEventHandler<HTMLDivElement>;
}

interface ExplorerDragCapability {
  readonly targetId: string | null;
  readonly onTargetChange: (id: string | null) => void;
  readonly onDrop: (event: DragEvent, parentId: string) => void;
  readonly onDragStart: (
    entry: FilesystemEntry,
    event: DragEvent<HTMLButtonElement>,
  ) => void;
}

interface ExplorerPropertiesCapability {
  readonly selectedDirectory: DirectoryEntry | null;
  readonly onShow: (entry: DirectoryEntry) => void;
}

interface ExplorerContextMenuCapability {
  readonly onEntry?: (
    entry: FilesystemEntry,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  readonly onDirectory?: (event: MouseEvent<HTMLDivElement>) => void;
}

interface ExplorerDirectoryViewProps {
  readonly page: FilesystemDirectoryPage;
  readonly busy: boolean;
  readonly currentDirectoryId: string;
  readonly selection: ExplorerSelectionCapability;
  readonly thumbnailUrl: (id: string) => string;
  readonly emptyLabel: string;
  readonly loadMoreLabel: string;
  readonly onOpenEntry: (entry: FilesystemEntry) => void;
  readonly onLoadMore: () => void;
  readonly marquee?: ExplorerMarqueeCapability;
  readonly drag?: ExplorerDragCapability;
  readonly properties?: ExplorerPropertiesCapability;
  readonly contextMenu?: ExplorerContextMenuCapability;
}

export function ExplorerDirectoryView({
  page,
  busy,
  currentDirectoryId,
  selection,
  thumbnailUrl,
  emptyLabel,
  loadMoreLabel,
  onOpenEntry,
  onLoadMore,
  marquee,
  drag,
  properties,
  contextMenu,
}: ExplorerDirectoryViewProps) {
  const onEntryContextMenu = contextMenu?.onEntry;
  return (
    <div
      ref={marquee?.contentRef}
      className="explorer-content"
      data-drop-target={drag?.targetId === currentDirectoryId || undefined}
      onPointerDown={marquee?.onPointerDown}
      onPointerMove={marquee?.onPointerMove}
      onPointerUp={marquee?.onPointerUp}
      onPointerCancel={marquee?.onPointerCancel}
      onKeyDown={(event) => handleSelectionKeyDown(event, selection, properties)}
      onDragEnter={
        drag
          ? (event) => {
              if (event.target === event.currentTarget) {
                drag.onTargetChange(currentDirectoryId);
              }
            }
          : undefined
      }
      onDragLeave={
        drag
          ? (event) => {
              if (event.target === event.currentTarget) drag.onTargetChange(null);
            }
          : undefined
      }
      onDragOver={drag ? (event) => event.preventDefault() : undefined}
      onDrop={drag ? (event) => drag.onDrop(event, currentDirectoryId) : undefined}
      onContextMenu={contextMenu?.onDirectory}
    >
      {page.items.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={
            selection.selectedIds.has(entry.id)
              ? "explorer-item explorer-item--selected"
              : "explorer-item"
          }
          aria-pressed={selection.selectedIds.has(entry.id)}
          {...{ [FILESYSTEM_SELECTION_DATA_ATTRIBUTE]: entry.id }}
          data-drop-target={drag?.targetId === entry.id || undefined}
          draggable={Boolean(drag)}
          onClick={(event) => selection.onSelect(entry.id, event)}
          onDoubleClick={() => onOpenEntry(entry)}
          onContextMenu={
            onEntryContextMenu
              ? (event) => onEntryContextMenu(entry, event)
              : undefined
          }
          onDragStart={drag ? (event) => drag.onDragStart(entry, event) : undefined}
          onDragOver={
            drag && entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
              ? (event) => event.preventDefault()
              : undefined
          }
          onDragEnter={
            drag && entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
              ? (event) => {
                  event.stopPropagation();
                  drag.onTargetChange(entry.id);
                }
              : undefined
          }
          onDragLeave={
            drag && entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
              ? () => drag.onTargetChange(null)
              : undefined
          }
          onDrop={
            drag && entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
              ? (event) => drag.onDrop(event, entry.id)
              : undefined
          }
          onKeyDown={(event) => {
            if (event.key !== KEYBOARD_KEY.ENTER) return;
            if (
              event.altKey &&
              properties &&
              entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
            ) {
              event.preventDefault();
              event.stopPropagation();
              properties.onShow(entry);
              return;
            }
            onOpenEntry(entry);
          }}
        >
          <FilesystemEntryIcon entry={entry} thumbnailUrl={thumbnailUrl} />
          <span>{entry.name}</span>
          {entry.kind === FILESYSTEM_ENTRY_KIND.FILE ? (
            <small>{formatFileSize(entry.size)}</small>
          ) : null}
        </button>
      ))}
      {marquee ? <FilesystemSelectionMarquee bounds={marquee.bounds} /> : null}
      {page.items.length === 0 ? (
        <p className="explorer-empty">{emptyLabel}</p>
      ) : null}
      {page.nextOffset !== null ? (
        <button
          type="button"
          className="explorer-load-more"
          disabled={busy}
          onClick={onLoadMore}
        >
          {loadMoreLabel}
        </button>
      ) : null}
    </div>
  );
}

function handleSelectionKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  selection: ExplorerSelectionCapability,
  properties?: ExplorerPropertiesCapability,
): void {
  if (
    event.altKey &&
    event.key === KEYBOARD_KEY.ENTER &&
    properties?.selectedDirectory
  ) {
    event.preventDefault();
    properties.onShow(properties.selectedDirectory);
  } else if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLocaleLowerCase() === KEYBOARD_KEY.A &&
    selection.onSelectAll
  ) {
    event.preventDefault();
    selection.onSelectAll();
  } else if (event.key === KEYBOARD_KEY.ESCAPE) {
    selection.onClear?.();
  }
}
