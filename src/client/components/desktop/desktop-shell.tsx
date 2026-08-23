import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "../../../constants/filesystem";
import { WIDGET_TYPE, WINDOW_STATE } from "../../../constants/widget";
import { mediaKindFromContentType } from "../../../domain/media-type";
import type { FilesystemEntry } from "../../../types/filesystem";
import type { WidgetType } from "../../../types/widget";
import {
  DASHBOARD_COPY,
  SITE_COPY,
  UNSAVED_WIDGET_TITLE_BY_TYPE,
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
import { useExplorerWindows } from "../../hooks/use-explorer-windows";
import { useDesktopEntries } from "../../hooks/use-desktop-entries";
import { useFilesystemUpload } from "../../hooks/use-filesystem-upload";
import { desktopIconLayout } from "../../domain/desktop-icon-layout";
import { collectDroppedUploadNodes } from "../../domain/local-file-tree";
import {
  readFilesystemDragPayload,
  writeFilesystemDragPayload,
} from "../../domain/filesystem-drag";
import type { DragFilesystemEntryPayload } from "../../types/filesystem";
import type {
  DesktopShellProps,
  TaskbarWindowItem,
  WindowBounds,
} from "../../types/desktop";
import type { SystemAppId } from "../../types/system-app";
import { DocumentsWindow } from "../filesystem/documents-window";
import { MyComputerWindow } from "../filesystem/my-computer-window";
import { RecycleBinWindow } from "../filesystem/recycle-bin-window";
import { UploadTransferDialog } from "../filesystem/upload-transfer-dialog";
import {
  UnsavedWidgetDialog,
  WidgetSaveDialog,
} from "../filesystem/widget-file-dialogs";
import { MediaViewerWindow } from "../media/media-viewer-window";
import { DesktopNotification } from "./desktop-notification";
import { DesktopShortcuts } from "./desktop-shortcuts";
import { DesktopWindow } from "./desktop-window";
import { StartMenu } from "./start-menu";
import { Taskbar } from "./taskbar";
import { downloadFile } from "../../utils/download-file";
import {
  FILESYSTEM_COPY,
  FILESYSTEM_DRAG_SOURCE,
} from "../../constants/filesystem";

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
  "--desktop-shortcut-row-height": `${DESKTOP_LAYOUT.SHORTCUT_ROW_HEIGHT_PX}px`,
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
  onOpenWidget,
  onSaveWidgetFile,
  onCloseWidget,
  onDiscardWidget,
  onRemoveWidgets,
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
  const explorer = useExplorerWindows();
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [selectedShortcutId, setSelectedShortcutId] = useState<string | null>(null);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(activeWidgetId);
  const [zOrders, setZOrders] = useState<Readonly<Record<string, number>>>({});
  const [filesystemRevision, setFilesystemRevision] = useState(0);
  const [saveWidgetId, setSaveWidgetId] = useState<string | null>(null);
  const [closePromptWidgetId, setClosePromptWidgetId] = useState<string | null>(null);
  const [closeAfterSaveWidgetId, setCloseAfterSaveWidgetId] = useState<string | null>(null);
  const [widgetDialogBusy, setWidgetDialogBusy] = useState(false);
  const [desktopError, setDesktopError] = useState<string | null>(null);
  const [isDesktopDropTarget, setIsDesktopDropTarget] = useState(false);
  const [dismissedOverflowCount, setDismissedOverflowCount] = useState<
    number | null
  >(null);
  const nextZOrder = useRef(100);
  const desktopEntries = useDesktopEntries(
    filesystemGateway,
    filesystemRevision,
  );
  const iconLayout = useMemo(() => desktopIconLayout(desktop), [desktop]);
  const visibleDesktopEntries = useMemo(
    () => desktopEntries.entries.slice(0, iconLayout.dynamicCapacity),
    [desktopEntries.entries, iconLayout.dynamicCapacity],
  );
  const desktopOverflowCount = Math.max(
    0,
    desktopEntries.entries.length - visibleDesktopEntries.length,
  );

  useEffect(() => {
    setDismissedOverflowCount(null);
  }, [desktop.width, desktop.height, desktopEntries.entries.length]);

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
  const upload = useFilesystemUpload(
    filesystemGateway,
    notifyFilesystemChanged,
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
      focusDesktopWindow(id);
    },
    [focusDesktopWindow, system],
  );
  const openDocumentsDirectory = useCallback(
    (directoryId: string, title: string, iconPath: string): void => {
      const id = explorer.open(
        { directoryId, title, iconPath },
        desktop,
      );
      focusDesktopWindow(id);
    },
    [desktop, explorer.open, focusDesktopWindow],
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

  const openFilesystemEntry = useCallback(
    (entry: FilesystemEntry): void => {
      if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
        openDocumentsDirectory(
          entry.id,
          entry.name,
          DESKTOP_ASSET_PATHS.FOLDER_ICON,
        );
        return;
      }
      if (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET) {
        void onOpenWidget(entry.widgetId);
        return;
      }
      const kind = mediaKindFromContentType(entry.contentType);
      if (kind) {
        openMediaViewer({ entry, directoryId: entry.parentId, kind });
      } else {
        downloadFile(filesystemGateway.downloadUrl(entry.id));
      }
    },
    [filesystemGateway, onOpenWidget, openDocumentsDirectory, openMediaViewer],
  );

  const synchronizeWidgetFile = useCallback(
    (entry: FilesystemEntry): void => {
      if (entry.kind !== FILESYSTEM_ENTRY_KIND.WIDGET) return;
      const widget = widgets.find(
        (candidate) => candidate.id === entry.widgetId,
      );
      if (!widget) return;
      onWidgetChange({
        ...widget,
        file: {
          entryId: entry.id,
          parentId: entry.parentId,
          name: entry.name,
        },
      });
    },
    [onWidgetChange, widgets],
  );

  const desktopPlacement = useCallback(
    (targetIndex = desktopEntries.entries.length) => ({
      targetIndex,
      capacity: iconLayout.dynamicCapacity,
    }),
    [desktopEntries.entries.length, iconLayout.dynamicCapacity],
  );

  const runFilesystemChange = useCallback(
    async (operation: () => Promise<unknown>): Promise<void> => {
      setDesktopError(null);
      try {
        await operation();
        notifyFilesystemChanged();
      } catch (error) {
        setDesktopError(errorMessage(error, FILESYSTEM_COPY.CHANGE_FAILED));
      }
    },
    [notifyFilesystemChanged],
  );
  const removeWidgetWindows = useCallback(
    (widgetIds: readonly string[]): void => {
      if (widgetIds.length === 0) return;
      const ids = new Set(widgetIds);
      setActiveWindowId((current) =>
        current && ids.has(current) ? null : current,
      );
      onRemoveWidgets(widgetIds);
    },
    [onRemoveWidgets],
  );

  const movePayload = useCallback(
    async (
      payload: DragFilesystemEntryPayload,
      parentId: string,
      targetIndex?: number,
    ): Promise<FilesystemEntry> => {
      const placement =
        parentId === FILESYSTEM_ROOT_ID.DESKTOP
          ? desktopPlacement(targetIndex)
          : undefined;
      if (payload.source === FILESYSTEM_DRAG_SOURCE.TRASH) {
        return filesystemGateway.restoreEntry(payload.id, {
          parentId,
          ...(placement === undefined ? {} : { desktopPlacement: placement }),
        });
      } else {
        return filesystemGateway.moveEntry(payload.id, {
          parentId,
          ...(placement === undefined ? {} : { desktopPlacement: placement }),
        });
      }
    },
    [desktopPlacement, filesystemGateway],
  );

  const uploadDrop = useCallback(
    async (event: DragEvent, parentId: string): Promise<void> => {
      const selection = await collectDroppedUploadNodes(event.dataTransfer.items);
      const notice = selection.folderDropUnsupported
        ? FILESYSTEM_COPY.FOLDER_DROP_UNSUPPORTED
        : null;
      await upload.upload(
        selection.nodes,
        parentId,
        parentId === FILESYSTEM_ROOT_ID.DESKTOP
          ? desktopPlacement()
          : undefined,
        notice,
      );
    },
    [desktopPlacement, upload],
  );

  const handleDrop = useCallback(
    (
      event: DragEvent,
      parentId: string,
      targetIndex?: number,
    ): void => {
      const payload = readFilesystemDragPayload(event.dataTransfer);
      if (payload) {
        void runFilesystemChange(async () => {
          synchronizeWidgetFile(
            await movePayload(payload, parentId, targetIndex),
          );
        });
      } else {
        void uploadDrop(event, parentId).catch((error: unknown) =>
          setDesktopError(errorMessage(error, FILESYSTEM_COPY.CHANGE_FAILED)),
        );
      }
    },
    [movePayload, runFilesystemChange, synchronizeWidgetFile, uploadDrop],
  );

  const dropOnSystemApp = useCallback(
    (id: SystemAppId, event: DragEvent<HTMLButtonElement>): void => {
      if (id === SYSTEM_APP_ID.MY_COMPUTER) {
        setDesktopError(FILESYSTEM_COPY.DROP_NOT_ALLOWED);
        return;
      }
      const payload = readFilesystemDragPayload(event.dataTransfer);
      if (id === SYSTEM_APP_ID.RECYCLE_BIN) {
        if (!payload || payload.source === FILESYSTEM_DRAG_SOURCE.TRASH) {
          setDesktopError(FILESYSTEM_COPY.DROP_NOT_ALLOWED);
          return;
        }
        void runFilesystemChange(async () => {
          const result = await filesystemGateway.trashEntry(payload.id);
          removeWidgetWindows(result.closedWidgetIds);
        });
        return;
      }
      handleDrop(event, FILESYSTEM_ROOT_ID.DOCUMENTS);
    },
    [filesystemGateway, handleDrop, removeWidgetWindows, runFilesystemChange],
  );

  const dropOnEntry = useCallback(
    (
      entry: FilesystemEntry,
      index: number,
      event: DragEvent<HTMLButtonElement>,
    ): void => {
      if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
        handleDrop(event, entry.id);
      } else {
        handleDrop(event, FILESYSTEM_ROOT_ID.DESKTOP, index);
      }
    },
    [handleDrop],
  );

  const requestWidgetClose = useCallback(
    (widgetId: string): void => {
      const widget = widgets.find((candidate) => candidate.id === widgetId);
      if (!widget) return;
      if (!widget.file) {
        setClosePromptWidgetId(widgetId);
        return;
      }
      void onCloseWidget(widgetId)
        .then(() => {
          setActiveWindowId((current) =>
            current === widgetId ? null : current,
          );
        })
        .catch((error: unknown) => {
          setDesktopError(errorMessage(error, FILESYSTEM_COPY.CHANGE_FAILED));
        });
    },
    [onCloseWidget, widgets],
  );

  const saveWidget = useCallback(
    async (parentId: string, name: string): Promise<void> => {
      if (!saveWidgetId) return;
      setWidgetDialogBusy(true);
      try {
        await onSaveWidgetFile(saveWidgetId, {
          parentId,
          name,
          ...(parentId === FILESYSTEM_ROOT_ID.DESKTOP
            ? { desktopPlacement: desktopPlacement() }
            : {}),
        });
        notifyFilesystemChanged();
        const shouldClose = closeAfterSaveWidgetId === saveWidgetId;
        setSaveWidgetId(null);
        setCloseAfterSaveWidgetId(null);
        if (shouldClose) {
          await onCloseWidget(saveWidgetId);
          setActiveWindowId((current) =>
            current === saveWidgetId ? null : current,
          );
        }
      } catch (error) {
        setDesktopError(errorMessage(error, FILESYSTEM_COPY.CHANGE_FAILED));
      } finally {
        setWidgetDialogBusy(false);
      }
    },
    [
      closeAfterSaveWidgetId,
      desktopPlacement,
      notifyFilesystemChanged,
      onCloseWidget,
      onSaveWidgetFile,
      saveWidgetId,
    ],
  );

  const activateTaskbarWindow = useCallback(
    (id: string): void => {
      const explorerWindow = explorer.windows.find((window) => window.id === id);
      if (explorerWindow) {
        if (explorerWindow.windowState === WINDOW_STATE.MINIMIZED) {
          explorer.restore(id);
          focusDesktopWindow(id);
        } else if (activeWindowId === id) {
          explorer.minimize(id);
          setActiveWindowId(null);
        } else {
          focusDesktopWindow(id);
        }
        return;
      }
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
      explorer,
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
        title: widget.file?.name ?? unsavedWidgetTitle(widget.type),
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
      ...explorer.windows.map((window) => ({
        id: window.id,
        title: window.title,
        iconPath: window.iconPath,
        isActive: activeWindowId === window.id,
        isMinimized: window.windowState === WINDOW_STATE.MINIMIZED,
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
    [activeWindowId, explorer.windows, media.windows, system.windows, widgets],
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

  const desktopStyle = {
    ...DESKTOP_BACKGROUND_STYLE,
    "--desktop-shortcut-row-count": iconLayout.rowCount,
  } as CSSProperties;

  return (
    <div className="desktop-shell" style={desktopStyle}>
      <main
        ref={workAreaRef}
        className="desktop-work-area"
        data-drop-target={isDesktopDropTarget}
        aria-label={DASHBOARD_COPY.DESKTOP}
        onMouseDown={(event) => {
          closeStartMenu();
          if (event.target === event.currentTarget) setSelectedShortcutId(null);
        }}
        onDragEnter={(event) => {
          if (event.target === event.currentTarget) {
            setIsDesktopDropTarget(true);
          }
        }}
        onDragLeave={(event) => {
          if (event.target === event.currentTarget) {
            setIsDesktopDropTarget(false);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setIsDesktopDropTarget(false);
          handleDrop(event, FILESYSTEM_ROOT_ID.DESKTOP);
        }}
      >
        <DesktopShortcuts
          entries={visibleDesktopEntries}
          selectedId={selectedShortcutId}
          thumbnailUrl={(id) => filesystemGateway.thumbnailUrl(id)}
          onSelect={setSelectedShortcutId}
          onOpenSystem={(id) => {
            if (id === SYSTEM_APP_ID.DOCUMENTS) {
              const config = SYSTEM_APP_CONFIG[SYSTEM_APP_ID.DOCUMENTS];
              openDocumentsDirectory(
                FILESYSTEM_ROOT_ID.DOCUMENTS,
                config.title,
                config.iconPath,
              );
              return;
            }
            openSystemApp(id);
          }}
          onOpenEntry={openFilesystemEntry}
          onDragEntry={(entry, event) => {
            writeFilesystemDragPayload(event.dataTransfer, {
              id: entry.id,
              source: FILESYSTEM_DRAG_SOURCE.ACTIVE,
            });
          }}
          onDropSystem={dropOnSystemApp}
          onDropEntry={dropOnEntry}
        />
        {widgets.length === 0 &&
        desktopEntries.entries.length === 0 &&
        media.windows.length === 0 &&
        explorer.windows.length === 0 &&
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
            onClose={() => requestWidgetClose(widget.id)}
            onSaveFile={() => setSaveWidgetId(widget.id)}
            onCommitBounds={(bounds) => onCommitWindowBounds(widget.id, bounds)}
            onWidgetChange={onWidgetChange}
          />
        ))}
        {explorer.windows.map((window) => (
          <DocumentsWindow
            key={window.id}
            windowId={window.id}
            title={window.title}
            iconPath={window.iconPath}
            window={window}
            desktop={desktop}
            isActive={activeWindowId === window.id}
            zIndex={desktopWindowZIndex(window.id, zOrders, 70)}
            onFocus={() => focusDesktopWindow(window.id)}
            onMinimize={() => {
              explorer.minimize(window.id);
              setActiveWindowId(null);
            }}
            onToggleMaximize={() => {
              explorer.toggleMaximize(window.id);
              focusDesktopWindow(window.id);
            }}
            onClose={() => {
              explorer.close(window.id);
              setActiveWindowId((current) =>
                current === window.id ? null : current,
              );
            }}
            onCommitBounds={(bounds) =>
              explorer.commitBounds(window.id, bounds)
            }
            gateway={filesystemGateway}
            desktopCapacity={iconLayout.dynamicCapacity}
            filesystemRevision={filesystemRevision}
            onFilesystemChanged={notifyFilesystemChanged}
            onOpenMedia={openMediaViewer}
            initialDirectoryId={window.directoryId}
            onDirectoryChanged={explorer.changeDirectory}
            onOpenWidget={(widgetId) => void onOpenWidget(widgetId)}
            onEntryChanged={synchronizeWidgetFile}
            onWidgetsClosed={removeWidgetWindows}
            onUploadNodes={(nodes, parentId, notice) =>
              upload.upload(
                nodes,
                parentId,
                parentId === FILESYSTEM_ROOT_ID.DESKTOP
                  ? desktopPlacement()
                  : undefined,
                notice,
              )
            }
          />
        ))}
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
            desktopCapacity={iconLayout.dynamicCapacity}
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

      {saveWidgetId ? (
        <WidgetSaveDialog
          gateway={filesystemGateway}
          widgetType={
            widgets.find((widget) => widget.id === saveWidgetId)?.type ??
            WIDGET_TYPE.MEMO
          }
          busy={widgetDialogBusy}
          onSave={(parentId, name) => void saveWidget(parentId, name)}
          onCancel={() => {
            if (!widgetDialogBusy) {
              setSaveWidgetId(null);
              setCloseAfterSaveWidgetId(null);
            }
          }}
        />
      ) : null}
      {closePromptWidgetId ? (
        <UnsavedWidgetDialog
          busy={widgetDialogBusy}
          onSave={() => {
            setCloseAfterSaveWidgetId(closePromptWidgetId);
            setSaveWidgetId(closePromptWidgetId);
            setClosePromptWidgetId(null);
          }}
          onDiscard={() => {
            setWidgetDialogBusy(true);
            void onDiscardWidget(closePromptWidgetId)
              .then(() => {
                setActiveWindowId((current) =>
                  current === closePromptWidgetId ? null : current,
                );
                setClosePromptWidgetId(null);
              })
              .catch((error: unknown) => {
                setDesktopError(
                  errorMessage(error, FILESYSTEM_COPY.CHANGE_FAILED),
                );
              })
              .finally(() => setWidgetDialogBusy(false));
          }}
          onCancel={() => setClosePromptWidgetId(null)}
        />
      ) : null}
      <UploadTransferDialog state={upload.state} onClose={upload.close} />

      {layoutSaveStatus === LAYOUT_SAVE_STATUS.ERROR && layoutSaveError ? (
        <DesktopNotification
          title={DASHBOARD_COPY.SAVE_FAILED}
          message={layoutSaveError}
          actionLabel={DASHBOARD_COPY.RETRY}
          onAction={onRetrySave}
        />
      ) : desktopError || desktopEntries.error ? (
        <DesktopNotification
          title={SITE_COPY.TITLE}
          message={desktopError ?? desktopEntries.error ?? FILESYSTEM_COPY.LOAD_FAILED}
          actionLabel={DASHBOARD_COPY.CONFIRM}
          onAction={() => setDesktopError(null)}
        />
      ) : message ? (
        <DesktopNotification
          title={SITE_COPY.TITLE}
          message={message.text}
          actionLabel={DASHBOARD_COPY.CONFIRM}
          onAction={onDismissMessage}
        />
      ) : desktopOverflowCount > 0 &&
        dismissedOverflowCount !== desktopOverflowCount ? (
        <DesktopNotification
          title={SITE_COPY.TITLE}
          message={FILESYSTEM_COPY.DESKTOP_OVERFLOW(desktopOverflowCount)}
          actionLabel={FILESYSTEM_COPY.OPEN_DESKTOP}
          onAction={() => {
            setDismissedOverflowCount(desktopOverflowCount);
            openDocumentsDirectory(
              FILESYSTEM_ROOT_ID.DESKTOP,
              FILESYSTEM_ROOT_NAME.DESKTOP,
              DESKTOP_ASSET_PATHS.FOLDER_ICON,
            );
          }}
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

function unsavedWidgetTitle(type: WidgetType): string {
  return UNSAVED_WIDGET_TITLE_BY_TYPE[type];
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
