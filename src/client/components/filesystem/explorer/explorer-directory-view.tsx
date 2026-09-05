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
import { DIRECTORY_CONTENT_DROP_TARGET } from "@client/constants/filesystem/drag";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";
import { FilesystemSelectionMarquee } from "@client/components/filesystem/filesystem-selection-marquee";
import type { FilesystemMarqueeBounds } from "@client/hooks/filesystem/use-filesystem-marquee-selection";
import { formatFileSize } from "@client/utils/format-file-size";
import type { FilesystemDirectoryDropCapability } from "@client/types/filesystem/drag";

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

interface ExplorerDragCapability extends FilesystemDirectoryDropCapability {
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
      {...drag?.targets.getProps<HTMLDivElement>(
        DIRECTORY_CONTENT_DROP_TARGET,
        (event) => drag.onDrop(event, currentDirectoryId),
        { disabled: drag.disabled },
      )}
      onPointerDown={marquee?.onPointerDown}
      onPointerMove={marquee?.onPointerMove}
      onPointerUp={marquee?.onPointerUp}
      onPointerCancel={marquee?.onPointerCancel}
      onKeyDown={(event) => handleSelectionKeyDown(event, selection, properties)}
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
          {...(drag && entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
            ? drag.targets.getProps<HTMLButtonElement>(
                entry.id,
                (event) => drag.onDrop(event, entry.id),
                { disabled: drag.disabled },
              )
            : {})}
          draggable={Boolean(drag)}
          onClick={(event) => selection.onSelect(entry.id, event)}
          onDoubleClick={() => onOpenEntry(entry)}
          onContextMenu={
            onEntryContextMenu
              ? (event) => onEntryContextMenu(entry, event)
              : undefined
          }
          onDragStart={drag ? (event) => drag.onDragStart(entry, event) : undefined}
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
