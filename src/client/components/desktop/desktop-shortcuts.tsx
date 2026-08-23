import {
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { FilesystemEntry } from "../../../types/filesystem";
import { FILESYSTEM_COPY } from "../../constants/filesystem";
import { KEYBOARD_KEY } from "../../constants/keyboard";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID,
  SYSTEM_APP_ID_VALUES,
} from "../../constants/system-app";
import type { SystemAppId } from "../../types/system-app";
import { FilesystemEntryIcon } from "../filesystem/filesystem-entry-icon";

interface DesktopShortcutsProps {
  readonly entries: readonly FilesystemEntry[];
  readonly selectedId: string | null;
  readonly thumbnailUrl: (id: string) => string;
  readonly onSelect: (id: string) => void;
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
}

export function DesktopShortcuts({
  entries,
  selectedId,
  thumbnailUrl,
  onSelect,
  onOpenSystem,
  onOpenEntry,
  onDragEntry,
  onDropSystem,
  onDropEntry,
}: DesktopShortcutsProps) {
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  return (
    <nav className="desktop-shortcuts" aria-label={FILESYSTEM_COPY.DESKTOP_SHORTCUTS}>
      {SYSTEM_APP_ID_VALUES.map((id) => {
        const app = SYSTEM_APP_CONFIG[id];
        return (
          <ShortcutButton
            key={id}
            id={id}
            title={app.title}
            icon={<img src={app.iconPath} alt="" draggable={false} />}
            selected={selectedId === id}
            dropTarget={dropTargetId === id}
            canHighlightDrop={id !== SYSTEM_APP_ID.MY_COMPUTER}
            onSelect={onSelect}
            onOpen={() => onOpenSystem(id)}
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
          id={entry.id}
          title={entry.name}
          icon={
            <FilesystemEntryIcon
              entry={entry}
              thumbnailUrl={thumbnailUrl}
            />
          }
          selected={selectedId === entry.id}
          dropTarget={dropTargetId === entry.id}
          draggable
          onSelect={onSelect}
          onOpen={() => onOpenEntry(entry)}
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
  id,
  title,
  icon,
  selected,
  dropTarget,
  canHighlightDrop = true,
  draggable = false,
  onSelect,
  onOpen,
  onDragStart,
  onDrop,
  onDropTargetChange,
}: {
  readonly id: string;
  readonly title: string;
  readonly icon: ReactNode;
  readonly selected: boolean;
  readonly dropTarget: boolean;
  readonly canHighlightDrop?: boolean;
  readonly draggable?: boolean;
  readonly onSelect: (id: string) => void;
  readonly onOpen: () => void;
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
      data-drop-target={dropTarget && canHighlightDrop}
      draggable={draggable}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={() => onSelect(id)}
      onDoubleClick={onOpen}
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
        if (event.key === KEYBOARD_KEY.ENTER) {
          event.preventDefault();
          onSelect(id);
          onOpen();
        }
      }}
    >
      {icon}
      <span>{title}</span>
    </button>
  );
}
