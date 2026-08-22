import type { KeyboardEvent } from "react";
import { FILESYSTEM_COPY } from "../../constants/filesystem";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID_VALUES,
} from "../../constants/system-app";
import type { SystemAppId } from "../../types/system-app";

interface DesktopShortcutsProps {
  readonly selectedId: SystemAppId | null;
  readonly onSelect: (id: SystemAppId) => void;
  readonly onOpen: (id: SystemAppId) => void;
}

export function DesktopShortcuts({
  selectedId,
  onSelect,
  onOpen,
}: DesktopShortcutsProps) {
  return (
    <nav className="desktop-shortcuts" aria-label={FILESYSTEM_COPY.DESKTOP_SHORTCUTS}>
      {SYSTEM_APP_ID_VALUES.map((id) => {
        const app = SYSTEM_APP_CONFIG[id];
        return (
          <button
            key={id}
            type="button"
            className={
              selectedId === id
                ? "desktop-shortcut desktop-shortcut--selected"
                : "desktop-shortcut"
            }
            aria-pressed={selectedId === id}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => onSelect(id)}
            onDoubleClick={() => onOpen(id)}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onOpen(id);
              }
            }}
          >
            <img src={app.iconPath} alt="" draggable={false} />
            <span>{app.title}</span>
          </button>
        );
      })}
    </nav>
  );
}

