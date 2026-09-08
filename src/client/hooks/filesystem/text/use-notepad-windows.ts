import { useCallback, useRef, useState } from "react";
import { WINDOW_RESTORE_STATE, WINDOW_STATE } from "@/constants/widgets/widget";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { NOTEPAD_WINDOW } from "@client/constants/filesystem/text/notepad";
import { NOTEPAD_COPY } from "@client/content/ko/filesystem/text/notepad";
import { cascadeWindowPosition, minimizeWindow, restoreWindow, toggleMaximizeWindow } from "@client/domain/desktop/window-layout";
import type { DesktopDimensions } from "@client/types/desktop/window";
import type { NotepadWindowController, NotepadWindowState } from "@client/types/filesystem/text/notepad";

export function useNotepadWindows(): NotepadWindowController {
  const [windows, setWindows] = useState<readonly NotepadWindowState[]>([]);
  const current = useRef(windows);
  const change = useCallback((transform: (items: readonly NotepadWindowState[]) => readonly NotepadWindowState[]) => {
    current.current = transform(current.current);
    setWindows(current.current);
  }, []);
  const update = useCallback((id: string, transform: (item: NotepadWindowState) => NotepadWindowState) => {
    change((items) => items.map((item) => item.id === id ? transform(item) : item));
  }, [change]);
  const open = useCallback((file: FilesystemFileEntry, desktop: DesktopDimensions): string => {
    const id = `${NOTEPAD_WINDOW.ID_PREFIX}${file.id}`;
    change((items) => {
      if (items.some((item) => item.id === id)) return items.map((item) => item.id === id
        ? { ...(item.windowState === WINDOW_STATE.MINIMIZED ? restoreWindow(item) : item), file }
        : item);
      return [...items, {
        id, file,
        position: cascadeWindowPosition(items.length, NOTEPAD_WINDOW.SIZE, desktop),
        size: { ...NOTEPAD_WINDOW.SIZE },
        windowState: WINDOW_STATE.NORMAL,
        restoreState: WINDOW_RESTORE_STATE.NORMAL,
      }];
    });
    return id;
  }, [change]);
  const close = useCallback((id: string) => change((items) => items.filter((item) => item.id !== id)), [change]);
  const minimize = useCallback((id: string) => update(id, minimizeWindow), [update]);
  const restore = useCallback((id: string) => update(id, restoreWindow), [update]);
  const toggleMaximize = useCallback((id: string) => update(id, toggleMaximizeWindow), [update]);
  return {
    windows, open, close, minimize, restore, toggleMaximize,
    commitBounds: (id, bounds) => update(id, (item) => ({ ...item, ...bounds })),
    registrations: windows.map((item) => ({
      id: item.id, title: NOTEPAD_COPY.WINDOW_TITLE(item.file.name),
      iconPath: DESKTOP_ASSET_PATHS.MEMO_ICON, windowState: item.windowState,
      close: () => close(item.id), minimize: () => minimize(item.id),
      restore: () => restore(item.id), toggleMaximize: () => toggleMaximize(item.id),
    })),
  };
}
