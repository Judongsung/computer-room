import { useCallback, useRef, useState } from "react";
import { WINDOW_RESTORE_STATE, WINDOW_STATE } from "@/constants/widgets/widget";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import {
  cascadeWindowPosition,
  minimizeWindow,
  restoreWindow,
  toggleMaximizeWindow,
} from "@client/domain/desktop/window-layout";
import {
  MEDIA_WINDOW_CONFIG,
  MEDIA_WINDOW_ID_PREFIX,
} from "@client/constants/media/media";
import type { DesktopDimensions, WindowBounds } from "@client/types/desktop/window";
import type {
  MediaViewerOpenRequest,
  MediaWindowState,
} from "@client/types/media/media";

export function useMediaWindows() {
  const [windows, setWindows] = useState<readonly MediaWindowState[]>([]);
  const nextWindowNumber = useRef(1);

  const update = useCallback(
    (id: string, updater: (window: MediaWindowState) => MediaWindowState): void => {
      setWindows((current) =>
        current.map((window) => (window.id === id ? updater(window) : window)),
      );
    },
    [],
  );

  const open = useCallback(
    (request: MediaViewerOpenRequest, desktop: DesktopDimensions): string => {
      const number = nextWindowNumber.current++;
      const id = `${MEDIA_WINDOW_ID_PREFIX}${number}`;
      const config = MEDIA_WINDOW_CONFIG[request.kind];
      const size = { ...config.size };
      const window: MediaWindowState = {
        id,
        directoryId: request.directoryId,
        currentFile: request.entry,
        position: cascadeWindowPosition(number - 1, size, desktop),
        size,
        windowState: WINDOW_STATE.NORMAL,
        restoreState: WINDOW_RESTORE_STATE.NORMAL,
      };
      setWindows((current) => [...current, window]);
      return id;
    },
    [],
  );

  const close = useCallback((id: string): void => {
    setWindows((current) => current.filter((window) => window.id !== id));
  }, []);

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

  const changeFile = useCallback(
    (id: string, currentFile: FilesystemFileEntry): void => {
      update(id, (window) => ({ ...window, currentFile }));
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
    changeFile,
  };
}
