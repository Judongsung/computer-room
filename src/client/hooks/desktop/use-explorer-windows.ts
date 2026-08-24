import { useCallback, useRef, useState } from "react";
import { WINDOW_RESTORE_STATE, WINDOW_STATE } from "@/constants/widgets/widget";
import {
  cascadeWindowPosition,
  minimizeWindow,
  restoreWindow,
  toggleMaximizeWindow,
} from "@client/domain/desktop/window-layout";
import { EXPLORER_WINDOW_ID_PREFIX } from "@client/constants/filesystem/filesystem";
import { SYSTEM_APP_CONFIG, SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import type { DesktopDimensions, WindowBounds } from "@client/types/desktop/desktop";
import type {
  ExplorerWindowController,
  ExplorerWindowOpenRequest,
  ExplorerWindowState,
} from "@client/types/filesystem/filesystem";

export function useExplorerWindows(): ExplorerWindowController {
  const [windows, setWindows] = useState<readonly ExplorerWindowState[]>([]);
  const windowsRef = useRef(windows);
  const nextWindowNumber = useRef(1);

  const replaceWindows = useCallback(
    (
      updater: (
        current: readonly ExplorerWindowState[],
      ) => readonly ExplorerWindowState[],
    ): void => {
      setWindows((current) => {
        const next = updater(current);
        windowsRef.current = next;
        return next;
      });
    },
    [],
  );

  const update = useCallback(
    (
      id: string,
      updater: (window: ExplorerWindowState) => ExplorerWindowState,
    ): void => {
      replaceWindows((current) =>
        current.map((window) =>
          window.id === id ? updater(window) : window,
        ),
      );
    },
    [replaceWindows],
  );

  const open = useCallback(
    (request: ExplorerWindowOpenRequest, desktop: DesktopDimensions): string => {
      const existing = windowsRef.current.find(
        (window) => window.directoryId === request.directoryId,
      );
      if (existing) {
        update(existing.id, restoreWindow);
        return existing.id;
      }

      const number = nextWindowNumber.current++;
      const config = SYSTEM_APP_CONFIG[SYSTEM_APP_ID.DOCUMENTS];
      const size = { ...config.size };
      const id = `${EXPLORER_WINDOW_ID_PREFIX}${number}`;
      const window: ExplorerWindowState = {
        id,
        directoryId: request.directoryId,
        title: request.title,
        iconPath: request.iconPath,
        position: cascadeWindowPosition(number - 1, size, desktop),
        size,
        windowState: WINDOW_STATE.NORMAL,
        restoreState: WINDOW_RESTORE_STATE.NORMAL,
      };
      replaceWindows((current) => [...current, window]);
      return id;
    },
    [replaceWindows, update],
  );

  const close = useCallback(
    (id: string): void => {
      replaceWindows((current) =>
        current.filter((window) => window.id !== id),
      );
    },
    [replaceWindows],
  );

  const minimize = useCallback(
    (id: string): void => update(id, minimizeWindow),
    [update],
  );

  const restore = useCallback(
    (id: string): void => update(id, restoreWindow),
    [update],
  );

  const toggleMaximize = useCallback(
    (id: string): void => update(id, toggleMaximizeWindow),
    [update],
  );

  const commitBounds = useCallback(
    (id: string, bounds: WindowBounds): void => {
      update(id, (window) => ({ ...window, ...bounds }));
    },
    [update],
  );

  const changeDirectory = useCallback(
    (id: string, directoryId: string, title: string): void => {
      update(id, (window) => ({ ...window, directoryId, title }));
    },
    [update],
  );

  return {
    windows,
    open,
    close,
    minimize,
    restore,
    toggleMaximize,
    commitBounds,
    changeDirectory,
  };
}
