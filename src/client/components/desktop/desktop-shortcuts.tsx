import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { SYSTEM_APP_TITLE_BY_ID } from "@client/content/ko/desktop/system-app";
import {
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID,
  SYSTEM_APP_ID_VALUES,
} from "@client/constants/desktop/system-app";
import type { SystemAppId } from "@client/types/desktop/system-app";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";
import { FILESYSTEM_SELECTION_DATA_ATTRIBUTE } from "@client/constants/filesystem/filesystem";

interface DesktopShortcutsProps {
  readonly entries: readonly FilesystemEntry[];
  readonly selectedSystemId: SystemAppId | null;
  readonly selectedEntryIds: ReadonlySet<string>;
  readonly thumbnailUrl: (id: string) => string;
  readonly onSelectSystem: (id: SystemAppId) => void;
  readonly onSelectEntry: (
    id: string,
    event: SelectionModifiers,
  ) => void;
  readonly onOpenSystem: (id: SystemAppId) => void;
  readonly onOpenEntry: (entry: FilesystemEntry) => void;
  readonly onDragEntry: (
    entry: FilesystemEntry,
    event: DragEvent<HTMLButtonElement>,
  ) => void;
  readonly onDropSystem: (
    id: SystemAppId,
    event: DragEvent<HTMLButtonElement>,
  ) => void;
  readonly onDropEntry: (
    entry: FilesystemEntry,
    index: number,
    event: DragEvent<HTMLButtonElement>,
  ) => void;
  readonly onContextMenuEntry: (
    entry: FilesystemEntry,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  readonly onContextMenuSystem: (
    id: SystemAppId,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  readonly onShowEntryProperties: (entry: FilesystemEntry) => void;
  readonly onShowSystemProperties: (id: SystemAppId) => void;
}

interface SelectionModifiers {
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export function DesktopShortcuts({
  entries,
  selectedSystemId,
  selectedEntryIds,
  thumbnailUrl,
  onSelectSystem,
  onSelectEntry,
  onOpenSystem,
  onOpenEntry,
  onDragEntry,
  onDropSystem,
  onDropEntry,
  onContextMenuEntry,
  onContextMenuSystem,
  onShowEntryProperties,
  onShowSystemProperties,
}: DesktopShortcutsProps) {
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  return (
    <nav className="desktop-shortcuts" aria-label={FILESYSTEM_COPY.DESKTOP_SHORTCUTS}>
      {SYSTEM_APP_ID_VALUES.map((id) => {
        const app = SYSTEM_APP_CONFIG[id];
        return (
          <ShortcutButton
            key={id}
            title={SYSTEM_APP_TITLE_BY_ID[id]}
            icon={<img src={app.iconPath} alt="" draggable={false} />}
            selected={selectedSystemId === id}
            dropTarget={dropTargetId === id}
            canHighlightDrop={id !== SYSTEM_APP_ID.MY_COMPUTER}
            onSelect={() => onSelectSystem(id)}
            onOpen={() => onOpenSystem(id)}
            onContextMenu={(event) => onContextMenuSystem(id, event)}
            {...(id === SYSTEM_APP_ID.DOCUMENTS
              ? { onShowProperties: () => onShowSystemProperties(id) }
              : {})}
            onDrop={(event) => onDropSystem(id, event)}
            onDropTargetChange={(active) =>
              setDropTargetId(active ? id : null)
            }
          />
        );
      })}
      {entries.map((entry, index) => (
        <ShortcutButton
          key={entry.id}
          title={entry.name}
          icon={
            <FilesystemEntryIcon
              entry={entry}
              thumbnailUrl={thumbnailUrl}
            />
          }
          selected={selectedEntryIds.has(entry.id)}
          dropTarget={dropTargetId === entry.id}
          draggable
          selectionId={entry.id}
          onSelect={(event) => onSelectEntry(entry.id, event)}
          onOpen={() => onOpenEntry(entry)}
          onContextMenu={(event) => onContextMenuEntry(entry, event)}
          {...(entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
            ? { onShowProperties: () => onShowEntryProperties(entry) }
            : {})}
          onDragStart={(event) => onDragEntry(entry, event)}
          onDrop={(event) => onDropEntry(entry, index, event)}
          onDropTargetChange={(active) =>
            setDropTargetId(active ? entry.id : null)
          }
        />
      ))}
    </nav>
  );
}

function ShortcutButton({
  title,
  icon,
  selected,
  dropTarget,
  canHighlightDrop = true,
  draggable = false,
  selectionId,
  onSelect,
  onOpen,
  onContextMenu,
  onShowProperties,
  onDragStart,
  onDrop,
  onDropTargetChange,
}: {
  readonly title: string;
  readonly icon: ReactNode;
  readonly selected: boolean;
  readonly dropTarget: boolean;
  readonly canHighlightDrop?: boolean;
  readonly draggable?: boolean;
  readonly selectionId?: string;
  readonly onSelect: (event: SelectionModifiers) => void;
  readonly onOpen: () => void;
  readonly onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly onShowProperties?: () => void;
  readonly onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  readonly onDrop: (event: DragEvent<HTMLButtonElement>) => void;
  readonly onDropTargetChange: (active: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={
        selected
          ? "desktop-shortcut desktop-shortcut--selected"
          : "desktop-shortcut"
      }
      aria-pressed={selected}
      {...(selectionId
        ? { [FILESYSTEM_SELECTION_DATA_ATTRIBUTE]: selectionId }
        : {})}
      data-drop-target={dropTarget && canHighlightDrop}
      draggable={draggable}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnter={() => {
        if (canHighlightDrop) onDropTargetChange(true);
      }}
      onDragLeave={() => onDropTargetChange(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDropTargetChange(false);
        onDrop(event);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        if (
          event.altKey &&
          event.key === KEYBOARD_KEY.ENTER &&
          onShowProperties
        ) {
          event.preventDefault();
          onShowProperties();
        } else if (event.key === KEYBOARD_KEY.ENTER) {
          event.preventDefault();
          onSelect(event);
          onOpen();
        }
      }}
    >
      {icon}
      <span>{title}</span>
    </button>
  );
}
