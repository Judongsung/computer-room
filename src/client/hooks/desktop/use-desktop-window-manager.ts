import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WINDOW_STATE } from "@/constants/widgets/widget";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import type { DashboardWidget } from "@/types/widgets/widget";
import { MEDIA_WINDOW_CONFIG } from "@client/constants/media/media";
import { MEDIA_VIEWER_TITLE_BY_KIND } from "@client/content/ko/media/media";
import { SYSTEM_APP_CONFIG, SYSTEM_APP_ID_VALUES } from "@client/constants/desktop/system-app";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import { DESKTOP_WINDOW_INITIAL_ORDER } from "@client/constants/desktop/session/window-management";
import { UNSAVED_WIDGET_TITLE_BY_TYPE } from "@client/content/ko/widgets/content";
import { SYSTEM_APP_TITLE_BY_ID } from "@client/content/ko/desktop/system-app";
import type { TaskbarWindowItem } from "@client/types/desktop/desktop";
import type { DesktopWindowRegistration } from "@client/types/desktop/session/window-registration";
import type { useExplorerWindows } from "@client/hooks/desktop/use-explorer-windows";
import type { useSystemWindows } from "@client/hooks/desktop/use-system-windows";
import type { useMediaWindows } from "@client/hooks/media/use-media-windows";

interface DesktopWindowManagerOptions {
  readonly activeWidgetId: string | null;
  readonly widgets: readonly DashboardWidget[];
  readonly explorer: ReturnType<typeof useExplorerWindows>;
  readonly system: ReturnType<typeof useSystemWindows>;
  readonly media: ReturnType<typeof useMediaWindows>;
  readonly additionalWindows?: readonly DesktopWindowRegistration[];
  readonly onActivateWidget: (id: string) => void;
  readonly onFocusWidget: (id: string) => void;
  readonly onMinimizeWidget: (id: string) => void;
  readonly onToggleMaximizeWidget: (id: string) => void;
}

const EMPTY_REGISTRATIONS: readonly DesktopWindowRegistration[] = [];

export function useDesktopWindowManager({
  activeWidgetId, widgets, explorer, system, media,
  additionalWindows = EMPTY_REGISTRATIONS,
  onActivateWidget, onFocusWidget, onMinimizeWidget, onToggleMaximizeWidget,
}: DesktopWindowManagerOptions) {
  const [activeWindowId, setActiveWindowId] = useState<string | null>(activeWidgetId);
  const [zOrders, setZOrders] = useState<Readonly<Record<string, number>>>({});
  const nextZOrder = useRef(DESKTOP_WINDOW_INITIAL_ORDER);

  useEffect(() => {
    if (activeWidgetId) setActiveWindowId(activeWidgetId);
  }, [activeWidgetId]);

  const focus = useCallback((id: string, persist?: () => void): void => {
    const next = nextZOrder.current + 1;
    nextZOrder.current = next;
    setZOrders((current) => ({ ...current, [id]: next }));
    setActiveWindowId(id);
    persist?.();
  }, []);
  const clearActive = useCallback((id?: string): void => {
    setActiveWindowId((current) => (!id || current === id ? null : current));
  }, []);

  const registrations = useMemo<readonly DesktopWindowRegistration[]>(() => [
    ...widgets.map((widget) => ({
      id: widget.id,
      title: widget.file?.name ?? UNSAVED_WIDGET_TITLE_BY_TYPE[widget.type],
      iconPath: WIDGET_ICON_PATH_BY_TYPE[widget.type],
      windowState: widget.windowState,
      minimize: () => onMinimizeWidget(widget.id),
      restore: () => onActivateWidget(widget.id),
      toggleMaximize: () => onToggleMaximizeWidget(widget.id),
      focus: () => onFocusWidget(widget.id),
    })),
    ...SYSTEM_APP_ID_VALUES.filter((id) => system.windows[id].isOpen).map((id) => ({
      id, title: SYSTEM_APP_TITLE_BY_ID[id], iconPath: SYSTEM_APP_CONFIG[id].iconPath,
      windowState: system.windows[id].windowState,
      minimize: () => system.minimize(id), restore: () => system.restore(id),
      toggleMaximize: () => system.toggleMaximize(id), close: () => system.close(id),
    })),
    ...explorer.windows.map((window) => ({
      id: window.id, title: window.title, iconPath: window.iconPath, windowState: window.windowState,
      minimize: () => explorer.minimize(window.id), restore: () => explorer.restore(window.id),
      toggleMaximize: () => explorer.toggleMaximize(window.id), close: () => explorer.close(window.id),
    })),
    ...media.windows.flatMap((window) => {
      const kind = mediaKindFromContentType(window.currentFile.contentType);
      if (!kind) return [];
      return [{
        id: window.id,
        title: `${window.currentFile.name} - ${MEDIA_VIEWER_TITLE_BY_KIND[kind]}`,
        iconPath: MEDIA_WINDOW_CONFIG[kind].iconPath,
        windowState: window.windowState,
        minimize: () => media.minimize(window.id), restore: () => media.restore(window.id),
        toggleMaximize: () => media.toggleMaximize(window.id), close: () => media.close(window.id),
      }];
    }),
    ...additionalWindows,
  ], [widgets, system, explorer, media, additionalWindows, onMinimizeWidget, onActivateWidget, onToggleMaximizeWidget, onFocusWidget]);

  const activate = useCallback((id: string): void => {
    const window = registrations.find((item) => item.id === id);
    if (!window) return;
    if (window.windowState === WINDOW_STATE.MINIMIZED) {
      window.restore();
      focus(id);
    } else if (activeWindowId === id) {
      window.minimize();
      clearActive(id);
    } else focus(id, window.focus);
  }, [registrations, activeWindowId, focus, clearActive]);

  const restore = useCallback((id: string): void => {
    const window = registrations.find((item) => item.id === id);
    if (!window) return;
    if (window.windowState === WINDOW_STATE.MAXIMIZED) window.toggleMaximize();
    else if (window.windowState === WINDOW_STATE.MINIMIZED) window.restore();
    focus(id, window.focus);
  }, [registrations, focus]);

  const minimize = useCallback((id: string): void => {
    registrations.find((item) => item.id === id)?.minimize();
    clearActive(id);
  }, [registrations, clearActive]);

  const toggleMaximize = useCallback((id: string): void => {
    const window = registrations.find((item) => item.id === id);
    if (!window) return;
    window.toggleMaximize();
    focus(id);
  }, [registrations, focus]);

  const closeRegisteredWindow = useCallback((id: string): boolean => {
    const close = registrations.find((item) => item.id === id)?.close;
    if (!close) return false;
    close();
    clearActive(id);
    return true;
  }, [registrations, clearActive]);

  const taskbarWindows = useMemo<readonly TaskbarWindowItem[]>(() => registrations.map((window) => ({
    id: window.id, title: window.title, iconPath: window.iconPath,
    isActive: activeWindowId === window.id,
    isMinimized: window.windowState === WINDOW_STATE.MINIMIZED,
    isMaximized: window.windowState === WINDOW_STATE.MAXIMIZED,
  })), [activeWindowId, registrations]);

  return { activeWindowId, zOrders, focus, clearActive, activate, restore, minimize, toggleMaximize, taskbarWindows, closeRegisteredWindow } as const;
}
