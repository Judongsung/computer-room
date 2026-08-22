import { useCallback, useState } from "react";
import {
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "../../constants/widget";
import {
  INITIAL_SYSTEM_WINDOW_STATE,
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID_VALUES,
} from "../constants/system-app";
import type { WindowBounds } from "../types/desktop";
import type {
  SystemAppId,
  SystemWindowStateMap,
} from "../types/system-app";

export function useSystemWindows() {
  const [windows, setWindows] = useState<SystemWindowStateMap>(createInitialState);

  const update = useCallback(
    (
      id: SystemAppId,
      updater: (current: SystemWindowStateMap[SystemAppId]) => SystemWindowStateMap[SystemAppId],
    ): void => {
      setWindows((current) => ({ ...current, [id]: updater(current[id]) }));
    },
    [],
  );

  const open = useCallback(
    (id: SystemAppId): void => {
      update(id, (window) => ({
        ...window,
        isOpen: true,
        windowState:
          window.windowState === WINDOW_STATE.MINIMIZED
            ? window.restoreState
            : window.windowState,
      }));
    },
    [update],
  );

  const close = useCallback(
    (id: SystemAppId): void => update(id, (window) => ({ ...window, isOpen: false })),
    [update],
  );

  const minimize = useCallback(
    (id: SystemAppId): void => {
      update(id, (window) => ({
        ...window,
        restoreState:
          window.windowState === WINDOW_STATE.MAXIMIZED
            ? WINDOW_RESTORE_STATE.MAXIMIZED
            : WINDOW_RESTORE_STATE.NORMAL,
        windowState: WINDOW_STATE.MINIMIZED,
      }));
    },
    [update],
  );

  const restore = useCallback(
    (id: SystemAppId): void => {
      update(id, (window) => ({
        ...window,
        windowState:
          window.windowState === WINDOW_STATE.MINIMIZED
            ? window.restoreState
            : window.windowState,
      }));
    },
    [update],
  );

  const toggleMaximize = useCallback(
    (id: SystemAppId): void => {
      update(id, (window) => ({
        ...window,
        windowState:
          window.windowState === WINDOW_STATE.MAXIMIZED
            ? WINDOW_STATE.NORMAL
            : WINDOW_STATE.MAXIMIZED,
        restoreState: WINDOW_RESTORE_STATE.NORMAL,
      }));
    },
    [update],
  );

  const commitBounds = useCallback(
    (id: SystemAppId, bounds: WindowBounds): void => {
      update(id, (window) => ({ ...window, ...bounds }));
    },
    [update],
  );

  return { windows, open, close, minimize, restore, toggleMaximize, commitBounds };
}

function createInitialState(): SystemWindowStateMap {
  return Object.fromEntries(
    SYSTEM_APP_ID_VALUES.map((id) => [
      id,
      {
        id,
        isOpen: false,
        position: { ...SYSTEM_APP_CONFIG[id].position },
        size: { ...SYSTEM_APP_CONFIG[id].size },
        ...INITIAL_SYSTEM_WINDOW_STATE,
      },
    ]),
  ) as unknown as SystemWindowStateMap;
}

