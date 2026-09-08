import { useChecklistRefresh } from "@client/hooks/widgets/checklist/use-checklist-refresh";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
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

interface OpenRequest { promise: Promise<string | null> }
interface RefreshRequest { promise: Promise<void> }

export function useGuestProgramWindows(gateway: GuestGateway) {
  const session = useMemo(() => ({
    active: false,
    windows: [] as readonly DashboardWidget[],
    tokens: new Map<string, object>(),
    opens: new Map<string, OpenRequest>(),
    refresh: null as RefreshRequest | null,
    errors: new Set<string>(),
    dismissedVersion: 0,
  }), [gateway]);
  const [state, setState] = useState({ session, windows: session.windows, error: null as string | null });
  const nextWindowNumber = useRef(1);
  const publish = useCallback(() => {
    if (session.active) setState({ session, windows: session.windows,
      error: session.errors.size ? GUEST_COPY.PROGRAM_LOAD_FAILED : null });
  }, [session]);
  useLayoutEffect(() => {
    session.active = true;
    publish();
    return () => {
      session.active = false;
      session.windows = [];
      session.tokens.clear();
      session.opens.clear();
      session.errors.clear();
      session.refresh = null;
    };
  }, [session, publish]);
  const windows = state.session === session ? state.windows : [];
  const error = state.session === session ? state.error : null;

  const replace = useCallback((updater: (current: readonly DashboardWidget[]) => readonly DashboardWidget[]): void => {
    if (!session.active) return;
    session.windows = updater(session.windows);
    publish();
  }, [session, publish]);
  const update = useCallback((id: string, updater: (window: DashboardWidget) => DashboardWidget): void => {
    replace(current => current.map(window => window.id === id ? updater(window) : window));
  }, [replace]);

  const refresh = useCallback((): Promise<void> => {
    if (!session.active) return Promise.resolve();
    if (session.refresh) return session.refresh.promise;
    const request: RefreshRequest = { promise: Promise.resolve() };
    session.refresh = request;
    const dismissedVersion = session.dismissedVersion;
    const targets = session.windows.flatMap(window =>
      window.type === WIDGET_TYPE.DAILY_CHECKLIST && window.file
        ? [{ id: window.id, entryId: window.file.entryId, token: session.tokens.get(window.id) }] : []);
    const current = () => session.active && session.refresh === request;
    const valid = (target: typeof targets[number]) => current() && session.tokens.get(target.id) === target.token;
    request.promise = (async () => {
      const outcomes: { target: typeof targets[number]; failed: boolean }[] = [];
      try {
        for (const target of targets) {
          if (!current()) break;
          if (!valid(target)) continue;
          try {
            const doc = await gateway.getProgramDocument(target.entryId);
            if (!valid(target)) continue;
            const failed = doc.type !== WIDGET_TYPE.DAILY_CHECKLIST;
            if (!failed) update(target.id, window => ({ ...window, type: doc.type, data: doc.data }));
            outcomes.push({ target, failed });
          } catch {
            if (valid(target)) outcomes.push({ target, failed: true });
          }
        }
        if (!current()) return;
        // Decide the notification once; success in another window must not clear a failure.
        for (const { target, failed } of outcomes) {
          if (!valid(target)) continue;
          const key = windowErrorKey(target.id);
          if (!failed) session.errors.delete(key);
          else if (dismissedVersion === session.dismissedVersion) session.errors.add(key);
        }
        publish();
      } finally {
        if (current()) session.refresh = null;
      }
    })();
    return request.promise;
  }, [gateway, session, update, publish]);
  const nextResetAt = windows.flatMap(window => window.type === WIDGET_TYPE.DAILY_CHECKLIST ? [window.data.nextResetAt] : []).sort()[0] ?? "";
  useChecklistRefresh({ nextResetAt, refresh });

  const open = useCallback((entry: FilesystemWidgetEntry, desktop: DesktopDimensions): Promise<string | null> => {
    if (!session.active) return Promise.resolve(null);
    const existing = session.windows.find(window => window.file?.entryId === entry.id);
    if (existing) {
      update(existing.id, restoreWindow);
      return Promise.resolve(existing.id);
    }
    const pending = session.opens.get(entry.id);
    if (pending) return pending.promise;
    const request: OpenRequest = { promise: Promise.resolve(null) };
    session.opens.set(entry.id, request);
    const current = () => session.active && session.opens.get(entry.id) === request;
    const dismissedVersion = session.dismissedVersion;
    request.promise = (async () => {
      try {
        const document = await gateway.getProgramDocument(entry.id);
        if (!current()) return null;
        const number = nextWindowNumber.current++;
        const policy = WIDGET_WINDOW_POLICY[document.type];
        const size = { width: policy.DEFAULT_WIDTH, height: policy.DEFAULT_HEIGHT };
        const file: WidgetFileReference = {
          entryId: document.entry.id, parentId: document.entry.parentId, name: document.entry.name,
        };
        const common = {
          id: `${GUEST_DESKTOP_WINDOW_ID_PREFIX.PROGRAM}${number}`,
          position: cascadeWindowPosition(number - 1, size, desktop), size,
          windowState: WINDOW_STATE.NORMAL, restoreState: WINDOW_RESTORE_STATE.NORMAL,
          stackOrder: number - 1, file,
        } as const;
        const window = createGuestProgramWindow(document, common);
        session.tokens.set(window.id, {});
        session.errors.delete(entryErrorKey(entry.id));
        replace(currentWindows => [...currentWindows, window]);
        return window.id;
      } catch {
        if (current() && dismissedVersion === session.dismissedVersion) {
          session.errors.add(entryErrorKey(entry.id));
          publish();
        }
        return null;
      } finally {
        if (current()) session.opens.delete(entry.id);
      }
    })();
    return request.promise;
  }, [gateway, session, replace, update, publish]);

  const close = useCallback((id: string): void => {
    if (!session.active) return;
    session.tokens.delete(id);
    session.errors.delete(windowErrorKey(id));
    replace(current => current.filter(window => window.id !== id));
  }, [session, replace]);
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
    error,
    clearError: () => { session.errors.clear(); session.dismissedVersion++; publish(); },
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

function windowErrorKey(id: string): string { return `window:${id}`; }
function entryErrorKey(id: string): string { return `entry:${id}`; }
