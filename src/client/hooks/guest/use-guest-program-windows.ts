import { useCallback, useRef, useState } from "react";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import type {
  DashboardWidget,
  WidgetLayout,
  WidgetFileReference,
} from "@/types/widgets/widget";
import type { GuestProgramDocument } from "@/types/guest/guest";
import { assertNever } from "@/domain/shared/assert-never";
import type { FilesystemWidgetEntry } from "@/types/filesystem/filesystem";
import {
  cascadeWindowPosition,
  minimizeWindow,
  restoreWindow,
  toggleMaximizeWindow,
} from "@client/domain/desktop/window-layout";
import { GUEST_DESKTOP_WINDOW_ID_PREFIX } from "@client/constants/guest/guest";
import type {
  DesktopDimensions,
  WindowBounds,
} from "@client/types/desktop/desktop";
import type { GuestGateway } from "@client/types/guest/guest";

export function useGuestProgramWindows(gateway: GuestGateway) {
  const [windows, setWindows] = useState<readonly DashboardWidget[]>([]);
  const windowsRef = useRef(windows);
  const nextWindowNumber = useRef(1);

  const replace = useCallback(
    (
      updater: (
        current: readonly DashboardWidget[],
      ) => readonly DashboardWidget[],
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
      updater: (window: DashboardWidget) => DashboardWidget,
    ): void => {
      replace((current) =>
        current.map((window) =>
          window.id === id ? updater(window) : window,
        ),
      );
    },
    [replace],
  );

  const open = useCallback(
    async (
      entry: FilesystemWidgetEntry,
      desktop: DesktopDimensions,
    ): Promise<string> => {
      const existing = windowsRef.current.find(
        (window) => window.file?.entryId === entry.id,
      );
      if (existing) {
        update(existing.id, restoreWindow);
        return existing.id;
      }

      const document = await gateway.getProgramDocument(entry.id);
      const number = nextWindowNumber.current++;
      const policy = WIDGET_WINDOW_POLICY[document.type];
      const size = {
        width: policy.DEFAULT_WIDTH,
        height: policy.DEFAULT_HEIGHT,
      };
      const file: WidgetFileReference = {
        entryId: document.entry.id,
        parentId: document.entry.parentId,
        name: document.entry.name,
      };
      const common = {
        id: `${GUEST_DESKTOP_WINDOW_ID_PREFIX.PROGRAM}${number}`,
        position: cascadeWindowPosition(number - 1, size, desktop),
        size,
        windowState: WINDOW_STATE.NORMAL,
        restoreState: WINDOW_RESTORE_STATE.NORMAL,
        stackOrder: number - 1,
        file,
      } as const;
      const window = createGuestProgramWindow(document, common);
      replace((current) => [...current, window]);
      return window.id;
    },
    [gateway, replace, update],
  );

  const close = useCallback(
    (id: string): void =>
      replace((current) => current.filter((window) => window.id !== id)),
    [replace],
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
    (id: string, bounds: WindowBounds): void =>
      update(id, (window) => ({ ...window, ...bounds })),
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
  } as const;
}

type GuestProgramWindowBase = Omit<WidgetLayout, "type"> & {
  readonly file: WidgetFileReference;
};

function createGuestProgramWindow(
  document: GuestProgramDocument,
  base: GuestProgramWindowBase,
): DashboardWidget {
  switch (document.type) {
    case WIDGET_TYPE.MEMO:
      return { ...base, type: document.type, data: document.data };
    case WIDGET_TYPE.DAILY_CHECKLIST:
      return { ...base, type: document.type, data: document.data };
    default:
      return assertNever(document);
  }
}
