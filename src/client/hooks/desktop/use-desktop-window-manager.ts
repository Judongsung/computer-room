import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WINDOW_STATE } from "@/constants/widgets/widget";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import type { DashboardWidget } from "@/types/widgets/widget";
import { MEDIA_WINDOW_CONFIG } from "@client/constants/media/media";
import { MEDIA_VIEWER_TITLE_BY_KIND } from "@client/content/ko/media/media";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID_VALUES,
} from "@client/constants/desktop/system-app";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import { UNSAVED_WIDGET_TITLE_BY_TYPE } from "@client/content/ko/widgets/content";
import { SYSTEM_APP_TITLE_BY_ID } from "@client/content/ko/desktop/system-app";
import type { TaskbarWindowItem } from "@client/types/desktop/desktop";
import type { SystemAppId } from "@client/types/desktop/system-app";
import type { useExplorerWindows } from "@client/hooks/desktop/use-explorer-windows";
import type { useSystemWindows } from "@client/hooks/desktop/use-system-windows";
import type { useMediaWindows } from "@client/hooks/media/use-media-windows";

interface DesktopWindowManagerOptions {
  readonly activeWidgetId: string | null;
  readonly widgets: readonly DashboardWidget[];
  readonly explorer: ReturnType<typeof useExplorerWindows>;
  readonly system: ReturnType<typeof useSystemWindows>;
  readonly media: ReturnType<typeof useMediaWindows>;
  readonly onActivateWidget: (id: string) => void;
  readonly onFocusWidget: (id: string) => void;
  readonly onMinimizeWidget: (id: string) => void;
  readonly onToggleMaximizeWidget: (id: string) => void;
}

export function useDesktopWindowManager({
  activeWidgetId,
  widgets,
  explorer,
  system,
  media,
  onActivateWidget,
  onFocusWidget,
  onMinimizeWidget,
  onToggleMaximizeWidget,
}: DesktopWindowManagerOptions) {
  const [activeWindowId, setActiveWindowId] = useState<string | null>(activeWidgetId);
  const [zOrders, setZOrders] = useState<Readonly<Record<string, number>>>({});
  const nextZOrder = useRef(100);

  useEffect(() => {
    if (activeWidgetId) setActiveWindowId(activeWidgetId);
  }, [activeWidgetId]);

  const focus = useCallback((id: string, persist?: () => void): void => {
    nextZOrder.current += 1;
    setZOrders((current) => ({ ...current, [id]: nextZOrder.current }));
    setActiveWindowId(id);
    persist?.();
  }, []);

  const clearActive = useCallback((id?: string): void => {
    setActiveWindowId((current) => (!id || current === id ? null : current));
  }, []);

  const activate = useCallback((id: string): void => {
    const explorerWindow = explorer.windows.find((window) => window.id === id);
    if (explorerWindow) {
      if (explorerWindow.windowState === WINDOW_STATE.MINIMIZED) {
        explorer.restore(id);
        focus(id);
      } else if (activeWindowId === id) {
        explorer.minimize(id);
        clearActive(id);
      } else focus(id);
      return;
    }
    if (isSystemAppId(id)) {
      const window = system.windows[id];
      if (window.windowState === WINDOW_STATE.MINIMIZED) {
        system.restore(id);
        focus(id);
      } else if (activeWindowId === id) {
        system.minimize(id);
        clearActive(id);
      } else focus(id);
      return;
    }
    const mediaWindow = media.windows.find((window) => window.id === id);
    if (mediaWindow) {
      if (mediaWindow.windowState === WINDOW_STATE.MINIMIZED) {
        media.restore(id);
        focus(id);
      } else if (activeWindowId === id) {
        media.minimize(id);
        clearActive(id);
      } else focus(id);
      return;
    }
    const widget = widgets.find((candidate) => candidate.id === id);
    if (!widget) return;
    if (widget.windowState === WINDOW_STATE.MINIMIZED) {
      onActivateWidget(id);
      focus(id);
    } else if (activeWindowId === id) {
      onMinimizeWidget(id);
      clearActive(id);
    } else focus(id, () => onFocusWidget(id));
  }, [activeWindowId, clearActive, explorer, focus, media, onActivateWidget, onFocusWidget, onMinimizeWidget, system, widgets]);

  const restore = useCallback((id: string): void => {
    const explorerWindow = explorer.windows.find((window) => window.id === id);
    if (explorerWindow) {
      explorerWindow.windowState === WINDOW_STATE.MAXIMIZED
        ? explorer.toggleMaximize(id)
        : explorer.restore(id);
      focus(id);
      return;
    }
    if (isSystemAppId(id)) {
      system.windows[id].windowState === WINDOW_STATE.MAXIMIZED
        ? system.toggleMaximize(id)
        : system.restore(id);
      focus(id);
      return;
    }
    const mediaWindow = media.windows.find((window) => window.id === id);
    if (mediaWindow) {
      mediaWindow.windowState === WINDOW_STATE.MAXIMIZED
        ? media.toggleMaximize(id)
        : media.restore(id);
      focus(id);
      return;
    }
    const widget = widgets.find((candidate) => candidate.id === id);
    if (!widget) return;
    if (widget.windowState === WINDOW_STATE.MAXIMIZED) onToggleMaximizeWidget(id);
    else if (widget.windowState === WINDOW_STATE.MINIMIZED) onActivateWidget(id);
    focus(id, () => onFocusWidget(id));
  }, [explorer, focus, media, onActivateWidget, onFocusWidget, onToggleMaximizeWidget, system, widgets]);

  const minimize = useCallback((id: string): void => {
    if (explorer.windows.some((window) => window.id === id)) explorer.minimize(id);
    else if (isSystemAppId(id)) system.minimize(id);
    else if (media.windows.some((window) => window.id === id)) media.minimize(id);
    else if (widgets.some((widget) => widget.id === id)) onMinimizeWidget(id);
    clearActive(id);
  }, [clearActive, explorer, media, onMinimizeWidget, system, widgets]);

  const toggleMaximize = useCallback((id: string): void => {
    if (explorer.windows.some((window) => window.id === id)) explorer.toggleMaximize(id);
    else if (isSystemAppId(id)) system.toggleMaximize(id);
    else if (media.windows.some((window) => window.id === id)) media.toggleMaximize(id);
    else if (widgets.some((widget) => widget.id === id)) onToggleMaximizeWidget(id);
    else return;
    focus(id);
  }, [explorer, focus, media, onToggleMaximizeWidget, system, widgets]);

  const taskbarWindows = useMemo<readonly TaskbarWindowItem[]>(() => [
    ...widgets.map((widget) => ({
      id: widget.id,
      title: widget.file?.name ?? UNSAVED_WIDGET_TITLE_BY_TYPE[widget.type],
      iconPath: WIDGET_ICON_PATH_BY_TYPE[widget.type],
      isActive: activeWindowId === widget.id,
      isMinimized: widget.windowState === WINDOW_STATE.MINIMIZED,
      isMaximized: widget.windowState === WINDOW_STATE.MAXIMIZED,
    })),
    ...SYSTEM_APP_ID_VALUES.filter((id) => system.windows[id].isOpen).map((id) => ({
      id,
      title: SYSTEM_APP_TITLE_BY_ID[id],
      iconPath: SYSTEM_APP_CONFIG[id].iconPath,
      isActive: activeWindowId === id,
      isMinimized: system.windows[id].windowState === WINDOW_STATE.MINIMIZED,
      isMaximized: system.windows[id].windowState === WINDOW_STATE.MAXIMIZED,
    })),
    ...explorer.windows.map((window) => ({
      id: window.id,
      title: window.title,
      iconPath: window.iconPath,
      isActive: activeWindowId === window.id,
      isMinimized: window.windowState === WINDOW_STATE.MINIMIZED,
      isMaximized: window.windowState === WINDOW_STATE.MAXIMIZED,
    })),
    ...media.windows.flatMap((window) => {
      const kind = mediaKindFromContentType(window.currentFile.contentType);
      if (!kind) return [];
      const config = MEDIA_WINDOW_CONFIG[kind];
      return [{
        id: window.id,
        title: `${window.currentFile.name} - ${MEDIA_VIEWER_TITLE_BY_KIND[kind]}`,
        iconPath: config.iconPath,
        isActive: activeWindowId === window.id,
        isMinimized: window.windowState === WINDOW_STATE.MINIMIZED,
        isMaximized: window.windowState === WINDOW_STATE.MAXIMIZED,
      }];
    }),
  ], [activeWindowId, explorer.windows, media.windows, system.windows, widgets]);

  return { activeWindowId, zOrders, focus, clearActive, activate, restore, minimize, toggleMaximize, taskbarWindows } as const;
}

function isSystemAppId(id: string): id is SystemAppId {
  return (SYSTEM_APP_ID_VALUES as readonly string[]).includes(id);
}
