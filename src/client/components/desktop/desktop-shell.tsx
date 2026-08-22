import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { WIDGET_TYPE, WINDOW_STATE } from "../../../constants/widget";
import { mediaKindFromContentType } from "../../../domain/media-type";
import type { WidgetType } from "../../../types/widget";
import {
  DASHBOARD_COPY,
  SITE_COPY,
  WIDGET_TITLE_BY_TYPE,
} from "../../constants/content";
import {
  DESKTOP_ASSET_PATHS,
  DESKTOP_LAYOUT,
  WIDGET_ICON_PATH_BY_TYPE,
} from "../../constants/desktop";
import { LAYOUT_SAVE_STATUS } from "../../constants/layout-save";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID,
  SYSTEM_APP_ID_VALUES,
} from "../../constants/system-app";
import { MEDIA_WINDOW_CONFIG } from "../../constants/media";
import { useDesktopDimensions } from "../../hooks/use-desktop-dimensions";
import { useSystemWindows } from "../../hooks/use-system-windows";
import { useMediaWindows } from "../../hooks/use-media-windows";
import type {
  DesktopShellProps,
  TaskbarWindowItem,
  WindowBounds,
} from "../../types/desktop";
import type { SystemAppId } from "../../types/system-app";
import { DocumentsWindow } from "../filesystem/documents-window";
import { MyComputerWindow } from "../filesystem/my-computer-window";
import { RecycleBinWindow } from "../filesystem/recycle-bin-window";
import { MediaViewerWindow } from "../media/media-viewer-window";
import { DesktopNotification } from "./desktop-notification";
import { DesktopShortcuts } from "./desktop-shortcuts";
import { DesktopWindow } from "./desktop-window";
import { StartMenu } from "./start-menu";
import { Taskbar } from "./taskbar";

const DESKTOP_BACKGROUND_STYLE = {
  "--desktop-background-image": `url("${DESKTOP_ASSET_PATHS.BACKGROUND}")`,
  "--start-button-mask-image": `url("${DESKTOP_ASSET_PATHS.START_BUTTON_MASK}")`,
  "--start-menu-z-index": DESKTOP_LAYOUT.START_MENU_Z_INDEX,
  "--taskbar-z-index": DESKTOP_LAYOUT.TASKBAR_Z_INDEX,
  "--modal-z-index": DESKTOP_LAYOUT.MODAL_Z_INDEX,
  "--desktop-shortcut-left": `${DESKTOP_LAYOUT.SHORTCUT_LEFT_PX}px`,
  "--desktop-shortcut-top": `${DESKTOP_LAYOUT.SHORTCUT_TOP_PX}px`,
  "--desktop-shortcut-width": `${DESKTOP_LAYOUT.SHORTCUT_WIDTH_PX}px`,
  "--desktop-shortcut-icon-size": `${DESKTOP_LAYOUT.SHORTCUT_ICON_SIZE_PX}px`,
  "--desktop-shortcut-gap": `${DESKTOP_LAYOUT.SHORTCUT_GAP_PX}px`,
} as CSSProperties;

export function DesktopShell({
  session,
  widgets,
  activeWidgetId,
  gateway,
  filesystemGateway,
  layoutSaveStatus,
  layoutSaveError,
  message,
  onAddWidget,
  onFocusWindow,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onActivateTaskbarWindow,
  onCommitWindowBounds,
  onWidgetChange,
  onRetrySave,
  onDismissMessage,
}: DesktopShellProps) {
  const workAreaRef = useRef<HTMLElement>(null);
  const desktop = useDesktopDimensions(workAreaRef);
  const system = useSystemWindows();
  const media = useMediaWindows();
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [selectedShortcutId, setSelectedShortcutId] = useState<SystemAppId | null>(null);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(activeWidgetId);
  const [zOrders, setZOrders] = useState<Readonly<Record<string, number>>>({});
  const [filesystemRevision, setFilesystemRevision] = useState(0);
  const nextZOrder = useRef(100);

  useEffect(() => {
    if (activeWidgetId) {
      setActiveWindowId(activeWidgetId);
    }
  }, [activeWidgetId]);

  const closeStartMenu = useCallback(() => setIsStartMenuOpen(false), []);
  const notifyFilesystemChanged = useCallback(
    () => setFilesystemRevision((current) => current + 1),
    [],
  );
  const focusDesktopWindow = useCallback((id: string, persist?: () => void): void => {
    nextZOrder.current += 1;
    setZOrders((current) => ({ ...current, [id]: nextZOrder.current }));
    setActiveWindowId(id);
    persist?.();
  }, []);

  const addWidget = useCallback(
    (type: WidgetType): void => {
      onAddWidget(type, desktop);
      closeStartMenu();
    },
    [closeStartMenu, desktop, onAddWidget],
  );
  const openSystemApp = useCallback(
    (id: SystemAppId): void => {
      system.open(id);
      setSelectedShortcutId(id);
      focusDesktopWindow(id);
    },
    [focusDesktopWindow, system],
  );
  const openMediaViewer = useCallback(
    (request: Parameters<typeof media.open>[0]): void => {
      const id = media.open(request, desktop);
      focusDesktopWindow(id);
    },
    [desktop, focusDesktopWindow, media.open],
  );
  const closeSystemApp = useCallback(
    (id: SystemAppId): void => {
      system.close(id);
      setActiveWindowId((current) => (current === id ? null : current));
    },
    [system],
  );
  const minimizeSystemApp = useCallback(
    (id: SystemAppId): void => {
      system.minimize(id);
      setActiveWindowId((current) => (current === id ? null : current));
    },
    [system],
  );

  const activateTaskbarWindow = useCallback(
    (id: string): void => {
      if (isSystemAppId(id)) {
        const window = system.windows[id];
        if (window.windowState === WINDOW_STATE.MINIMIZED) {
          system.restore(id);
          focusDesktopWindow(id);
        } else if (activeWindowId === id) {
          minimizeSystemApp(id);
        } else {
          focusDesktopWindow(id);
        }
        return;
      }
      const mediaWindow = media.windows.find((window) => window.id === id);
      if (mediaWindow) {
        if (mediaWindow.windowState === WINDOW_STATE.MINIMIZED) {
          media.restore(id);
          focusDesktopWindow(id);
        } else if (activeWindowId === id) {
          media.minimize(id);
          setActiveWindowId(null);
        } else {
          focusDesktopWindow(id);
        }
        return;
      }
      const widget = widgets.find((candidate) => candidate.id === id);
      if (!widget) return;
      if (widget.windowState === WINDOW_STATE.MINIMIZED) {
        onActivateTaskbarWindow(id);
        focusDesktopWindow(id);
      } else if (activeWindowId === id) {
        onMinimizeWindow(id);
        setActiveWindowId(null);
      } else {
        focusDesktopWindow(id, () => onFocusWindow(id));
      }
    },
    [
      activeWindowId,
      focusDesktopWindow,
      minimizeSystemApp,
      media,
      onActivateTaskbarWindow,
      onFocusWindow,
      onMinimizeWindow,
      system,
      widgets,
    ],
  );

  const taskbarWindows = useMemo<readonly TaskbarWindowItem[]>(
    () => [
      ...widgets.map((widget) => ({
        id: widget.id,
        title: WIDGET_TITLE_BY_TYPE[widget.type],
        iconPath: WIDGET_ICON_PATH_BY_TYPE[widget.type],
        isActive: activeWindowId === widget.id,
        isMinimized: widget.windowState === WINDOW_STATE.MINIMIZED,
      })),
      ...SYSTEM_APP_ID_VALUES.filter((id) => system.windows[id].isOpen).map((id) => ({
        id,
        title: SYSTEM_APP_CONFIG[id].title,
        iconPath: SYSTEM_APP_CONFIG[id].iconPath,
        isActive: activeWindowId === id,
        isMinimized: system.windows[id].windowState === WINDOW_STATE.MINIMIZED,
      })),
      ...media.windows.flatMap((window) => {
        const kind = mediaKindFromContentType(window.currentFile.contentType);
        if (!kind) return [];
        const config = MEDIA_WINDOW_CONFIG[kind];
        return [{
          id: window.id,
          title: `${window.currentFile.name} - ${config.titleSuffix}`,
          iconPath: config.iconPath,
          isActive: activeWindowId === window.id,
          isMinimized: window.windowState === WINDOW_STATE.MINIMIZED,
        }];
      }),
    ],
    [activeWindowId, media.windows, system.windows, widgets],
  );

  const systemChrome = (id: SystemAppId) => ({
    window: system.windows[id],
    desktop,
    isActive: activeWindowId === id,
    zIndex: desktopWindowZIndex(id, zOrders, 60),
    onFocus: () => focusDesktopWindow(id),
    onMinimize: () => minimizeSystemApp(id),
    onToggleMaximize: () => {
      system.toggleMaximize(id);
      focusDesktopWindow(id);
    },
    onClose: () => closeSystemApp(id),
    onCommitBounds: (bounds: WindowBounds) => system.commitBounds(id, bounds),
  });

  return (
    <div className="desktop-shell" style={DESKTOP_BACKGROUND_STYLE}>
      <main
        ref={workAreaRef}
        className="desktop-work-area"
        aria-label={DASHBOARD_COPY.DESKTOP}
        onMouseDown={(event) => {
          closeStartMenu();
          if (event.target === event.currentTarget) setSelectedShortcutId(null);
        }}
      >
        <DesktopShortcuts
          selectedId={selectedShortcutId}
          onSelect={setSelectedShortcutId}
          onOpen={openSystemApp}
        />
        {widgets.length === 0 &&
        media.windows.length === 0 &&
        !SYSTEM_APP_ID_VALUES.some((id) => system.windows[id].isOpen) ? (
          <p className="desktop-empty-hint">{DASHBOARD_COPY.EMPTY_DESKTOP}</p>
        ) : null}
        {widgets.map((widget) => (
          <DesktopWindow
            key={widget.id}
            widget={widget}
            desktop={desktop}
            isActive={widget.id === activeWindowId}
            zIndex={desktopWindowZIndex(widget.id, zOrders, widget.stackOrder)}
            gateway={gateway}
            onFocus={() => focusDesktopWindow(widget.id, () => onFocusWindow(widget.id))}
            onMinimize={() => {
              onMinimizeWindow(widget.id);
              setActiveWindowId(null);
            }}
            onToggleMaximize={() => {
              onToggleMaximizeWindow(widget.id);
              focusDesktopWindow(widget.id);
            }}
            onCommitBounds={(bounds) => onCommitWindowBounds(widget.id, bounds)}
            onWidgetChange={onWidgetChange}
          />
        ))}
        {system.windows[SYSTEM_APP_ID.DOCUMENTS].isOpen ? (
          <DocumentsWindow
            {...systemChrome(SYSTEM_APP_ID.DOCUMENTS)}
            gateway={filesystemGateway}
            filesystemRevision={filesystemRevision}
            onFilesystemChanged={notifyFilesystemChanged}
            onOpenMedia={openMediaViewer}
          />
        ) : null}
        {system.windows[SYSTEM_APP_ID.MY_COMPUTER].isOpen ? (
          <MyComputerWindow
            {...systemChrome(SYSTEM_APP_ID.MY_COMPUTER)}
            onAddWidget={addWidget}
          />
        ) : null}
        {system.windows[SYSTEM_APP_ID.RECYCLE_BIN].isOpen ? (
          <RecycleBinWindow
            {...systemChrome(SYSTEM_APP_ID.RECYCLE_BIN)}
            gateway={filesystemGateway}
            filesystemRevision={filesystemRevision}
            onFilesystemChanged={notifyFilesystemChanged}
          />
        ) : null}
        {media.windows.map((window) => (
          <MediaViewerWindow
            key={window.id}
            window={window}
            desktop={desktop}
            gateway={filesystemGateway}
            filesystemRevision={filesystemRevision}
            isActive={activeWindowId === window.id}
            zIndex={desktopWindowZIndex(window.id, zOrders, 80)}
            onFocus={() => focusDesktopWindow(window.id)}
            onMinimize={() => {
              media.minimize(window.id);
              setActiveWindowId(null);
            }}
            onToggleMaximize={() => {
              media.toggleMaximize(window.id);
              focusDesktopWindow(window.id);
            }}
            onClose={() => {
              media.close(window.id);
              setActiveWindowId((current) =>
                current === window.id ? null : current,
              );
            }}
            onCommitBounds={(bounds) => media.commitBounds(window.id, bounds)}
            onChangeFile={(entry) => media.changeFile(window.id, entry)}
          />
        ))}
      </main>

      {layoutSaveStatus === LAYOUT_SAVE_STATUS.ERROR && layoutSaveError ? (
        <DesktopNotification
          title={DASHBOARD_COPY.SAVE_FAILED}
          message={layoutSaveError}
          actionLabel={DASHBOARD_COPY.RETRY}
          onAction={onRetrySave}
        />
      ) : message ? (
        <DesktopNotification
          title={SITE_COPY.TITLE}
          message={message.text}
          actionLabel={DASHBOARD_COPY.CONFIRM}
          onAction={onDismissMessage}
        />
      ) : null}
      <StartMenu
        isOpen={isStartMenuOpen}
        email={session.email}
        logoutUrl={session.logoutUrl}
        onClose={closeStartMenu}
        onAddMemo={() => addWidget(WIDGET_TYPE.MEMO)}
        onAddChecklist={() => addWidget(WIDGET_TYPE.DAILY_CHECKLIST)}
      />
      <Taskbar
        windows={taskbarWindows}
        isStartMenuOpen={isStartMenuOpen}
        saveStatus={layoutSaveStatus}
        onToggleStartMenu={() => setIsStartMenuOpen((current) => !current)}
        onActivateWindow={activateTaskbarWindow}
      />
    </div>
  );
}

function desktopWindowZIndex(
  id: string,
  zOrders: Readonly<Record<string, number>>,
  fallback: number,
): number {
  return DESKTOP_LAYOUT.BASE_WINDOW_Z_INDEX + (zOrders[id] ?? fallback);
}

function isSystemAppId(id: string): id is SystemAppId {
  return (SYSTEM_APP_ID_VALUES as readonly string[]).includes(id);
}
