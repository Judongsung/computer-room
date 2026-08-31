import { useState, type MouseEvent } from "react";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";

interface GuestDesktopShortcutsProps {
  readonly entries: readonly FilesystemEntry[];
  readonly thumbnailUrl: (id: string) => string;
  readonly onOpenDocuments: () => void;
  readonly onOpenEntry: (entry: FilesystemEntry) => void;
  readonly onContextMenuEntry: (
    entry: FilesystemEntry,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
}

export function GuestDesktopShortcuts({
  entries,
  thumbnailUrl,
  onOpenDocuments,
  onOpenEntry,
  onContextMenuEntry,
}: GuestDesktopShortcutsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <nav className="desktop-shortcuts" aria-label={GUEST_COPY.PUBLIC_SPACE}>
      <button
        type="button"
        className={shortcutClass(selectedId === "documents")}
        aria-pressed={selectedId === "documents"}
        onClick={() => setSelectedId("documents")}
        onDoubleClick={onOpenDocuments}
        onKeyDown={(event) => {
          if (event.key === KEYBOARD_KEY.ENTER) onOpenDocuments();
        }}
      >
        <img src={DESKTOP_ASSET_PATHS.DOCUMENTS_ICON} alt="" draggable={false} />
        <span>{GUEST_COPY.MY_DOCUMENTS}</span>
      </button>
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={shortcutClass(selectedId === entry.id)}
          aria-pressed={selectedId === entry.id}
          onClick={() => setSelectedId(entry.id)}
          onDoubleClick={() => onOpenEntry(entry)}
          onKeyDown={(event) => {
            if (event.key === KEYBOARD_KEY.ENTER) onOpenEntry(entry);
          }}
          onContextMenu={(event) => {
            setSelectedId(entry.id);
            onContextMenuEntry(entry, event);
          }}
        >
          <FilesystemEntryIcon entry={entry} thumbnailUrl={thumbnailUrl} />
          <span>{entry.name}</span>
        </button>
      ))}
    </nav>
  );
}

function shortcutClass(selected: boolean): string {
  return selected
    ? "desktop-shortcut desktop-shortcut--selected"
    : "desktop-shortcut";
}
