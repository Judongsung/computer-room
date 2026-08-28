import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "@/constants/filesystem/filesystem";
import {
  WIDGET_TYPE,
} from "@/constants/widgets/widget";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import { messageFromError } from "@client/errors/error-message";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { WidgetType } from "@/types/widgets/widget";
import {
  DASHBOARD_COPY,
  SITE_COPY,
} from "@client/constants/widgets/content";
import {
  DESKTOP_ASSET_PATHS,
  DESKTOP_LAYOUT,
} from "@client/constants/desktop/desktop";
import { LAYOUT_SAVE_STATUS } from "@client/constants/desktop/layout-save";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID,
  SYSTEM_APP_ID_VALUES,
} from "@client/constants/desktop/system-app";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { useDesktopDimensions } from "@client/hooks/desktop/use-desktop-dimensions";
import { useSystemWindows } from "@client/hooks/desktop/use-system-windows";
import { useDesktopWindowManager } from "@client/hooks/desktop/use-desktop-window-manager";
import { useWidgetFileLifecycle } from "@client/hooks/widgets/use-widget-file-lifecycle";
import { useMediaWindows } from "@client/hooks/media/use-media-windows";
import { useExplorerWindows } from "@client/hooks/desktop/use-explorer-windows";
import { useDesktopFilesystemController } from "@client/hooks/desktop/use-desktop-filesystem-controller";
import { useFolderProperties } from "@client/hooks/filesystem/use-folder-properties";
import { collectDroppedUploadNodes } from "@client/domain/filesystem/local-file-tree";
import {
  readFilesystemDragPayload,
  writeFilesystemDragPayload,
} from "@client/domain/filesystem/drag";
import type {
  DesktopFilesystemDialog,
  DragFilesystemEntryPayload,
} from "@client/types/filesystem/filesystem";
import type { DesktopShellProps } from "@client/types/desktop/desktop";
import type { SystemAppId } from "@client/types/desktop/system-app";
import { FilesystemSelectionMarquee } from "@client/components/filesystem/filesystem-selection-marquee";
import { DesktopNotification } from "@client/components/desktop/desktop-notification";
import { DesktopShortcuts } from "@client/components/desktop/desktop-shortcuts";
import { DesktopWindowLayer } from "@client/components/desktop/desktop-window-layer";
import { DesktopDialogLayer } from "@client/components/desktop/desktop-dialog-layer";
import { StartMenu } from "@client/components/desktop/start-menu";
import { Taskbar } from "@client/components/desktop/taskbar";
import { downloadFile } from "@client/utils/download-file";
import {
  FILESYSTEM_COPY,
  FILESYSTEM_DRAG_SOURCE,
} from "@client/constants/filesystem/filesystem";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import {
  contextMenuCommand,
  contextMenuSeparator,
} from "@client/domain/context-menu/context-menu";
import {
  XP_CONTEXT_MENU_COMMAND_ID,
  XP_CONTEXT_MENU_COPY,
} from "@client/constants/context-menu/context-menu";
import { FOLDER_PROPERTIES_COPY } from "@client/constants/filesystem/details";

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
  storageStatusGateway,
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
  const contextMenu = useXpContextMenu();
  const desktop = useDesktopDimensions(workAreaRef);
  const system = useSystemWindows();
  const media = useMediaWindows();
  const explorer = useExplorerWindows();
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [selectedSystemShortcutId, setSelectedSystemShortcutId] =
    useState<SystemAppId | null>(null);
  const [desktopError, setDesktopError] = useState<string | null>(null);
  const [isDesktopDropTarget, setIsDesktopDropTarget] = useState(false);
  const [batchResult, setBatchResult] = useState<FilesystemBatchResult | null>(
    null,
  );
  const [desktopDialog, setDesktopDialog] =
    useState<DesktopFilesystemDialog>(null);
  const [desktopDialogBusy, setDesktopDialogBusy] = useState(false);
  const [dismissedOverflowCount, setDismissedOverflowCount] = useState<
    number | null
  >(null);
  const windowManager = useDesktopWindowManager({
    activeWidgetId,
    widgets,
    explorer,
    system,
    media,
    onActivateWidget: onActivateTaskbarWindow,
    onFocusWidget: onFocusWindow,
    onMinimizeWidget: onMinimizeWindow,
    onToggleMaximizeWidget: onToggleMaximizeWindow,
  });
  const { activeWindowId, zOrders } = windowManager;
  const desktopFilesystem = useDesktopFilesystemController(
    filesystemGateway,
    workAreaRef,
    desktop,
  );
  const folderProperties = useFolderProperties(filesystemGateway);
  const {
    revision: filesystemRevision,
    notifyChanged: notifyFilesystemChanged,
    entries: desktopEntries,
    iconLayout,
    visibleEntries: visibleDesktopEntries,
    selection: desktopSelection,
    marquee: desktopMarquee,
    selectedEntries: selectedDesktopEntries,
    upload,
    download,
    overflowCount: desktopOverflowCount,
  } = desktopFilesystem;

  useEffect(() => {
    setDismissedOverflowCount(null);
  }, [desktop.width, desktop.height, desktopEntries.entries.length]);

  const closeStartMenu = useCallback(() => setIsStartMenuOpen(false), []);
  const focusDesktopWindow = windowManager.focus;

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
  const openSystemShortcut = useCallback(
    (id: SystemAppId): void => {
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
    },
    [openDocumentsDirectory, openSystemApp],
  );
  const openMediaViewer = useCallback(
    (request: Parameters<typeof media.open>[0]): void => {
      const id = media.open(request, desktop);
      focusDesktopWindow(id);
    },
    [desktop, focusDesktopWindow, media.open],
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
      if (!widget || widget.type === WIDGET_TYPE.STORAGE_STATUS) return;
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
  const widgetFiles = useWidgetFileLifecycle({
    widgets,
    desktopPlacement,
    onSaveFile: onSaveWidgetFile,
    onClose: onCloseWidget,
    onDiscard: onDiscardWidget,
    onFilesystemChanged: notifyFilesystemChanged,
    onWindowClosed: windowManager.clearActive,
    onError: (error) =>
      setDesktopError(messageFromError(error, FILESYSTEM_COPY.CHANGE_FAILED)),
  });

  const runFilesystemChange = useCallback(
    async (operation: () => Promise<unknown>): Promise<void> => {
      setDesktopError(null);
      try {
        await operation();
        notifyFilesystemChanged();
      } catch (error) {
        setDesktopError(messageFromError(error, FILESYSTEM_COPY.CHANGE_FAILED));
      }
    },
    [notifyFilesystemChanged],
  );
  const removeWidgetWindows = useCallback(
    (widgetIds: readonly string[]): void => {
      if (widgetIds.length === 0) return;
      widgetIds.forEach(windowManager.clearActive);
      onRemoveWidgets(widgetIds);
    },
    [onRemoveWidgets, windowManager],
  );

  const movePayload = useCallback(
    async (
      payload: DragFilesystemEntryPayload,
      parentId: string,
      targetIndex?: number,
    ): Promise<FilesystemBatchResult> => {
      const placement =
        parentId === FILESYSTEM_ROOT_ID.DESKTOP
          ? desktopPlacement(targetIndex)
          : undefined;
      if (payload.source === FILESYSTEM_DRAG_SOURCE.TRASH) {
        return filesystemGateway.restoreEntries(payload.ids, {
          parentId,
          ...(placement === undefined ? {} : { desktopPlacement: placement }),
        });
      } else {
        return filesystemGateway.moveEntries(payload.ids, {
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
          const result = await movePayload(payload, parentId, targetIndex);
          result.entries.forEach(synchronizeWidgetFile);
          removeWidgetWindows(result.closedWidgetIds);
          setBatchResult(result.failures.length > 0 ? result : null);
          desktopSelection.replace(
            result.failures.map((failure) => failure.id),
          );
        });
      } else {
        void uploadDrop(event, parentId).catch((error: unknown) =>
          setDesktopError(messageFromError(error, FILESYSTEM_COPY.CHANGE_FAILED)),
        );
      }
    },
    [
      desktopSelection.replace,
      movePayload,
      removeWidgetWindows,
      runFilesystemChange,
      synchronizeWidgetFile,
      uploadDrop,
    ],
  );

  const trashDesktopEntries = useCallback(
    (entries: readonly FilesystemEntry[]): void => {
      void runFilesystemChange(async () => {
        const result = await filesystemGateway.trashEntries(
          entries.map((entry) => entry.id),
        );
        removeWidgetWindows(result.closedWidgetIds);
        setBatchResult(result.failures.length > 0 ? result : null);
        desktopSelection.replace(
          result.failures.map((failure) => failure.id),
        );
      });
    },
    [
      desktopSelection.replace,
      filesystemGateway,
      removeWidgetWindows,
      runFilesystemChange,
    ],
  );

  const openDesktopEntryMenu = useCallback(
    (
      entry: FilesystemEntry,
      event: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number },
    ): void => {
      const entries = desktopSelection.selectedIds.has(entry.id)
        ? selectedDesktopEntries
        : [entry];
      const directory =
        entries.length === 1 &&
        entries[0]?.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
          ? entries[0]
          : null;
      if (!desktopSelection.selectedIds.has(entry.id)) {
        desktopSelection.replace([entry.id]);
      }
      setSelectedSystemShortcutId(null);
      contextMenu.openFromEvent(event, [
        contextMenuCommand(
          XP_CONTEXT_MENU_COMMAND_ID.OPEN,
          FILESYSTEM_COPY.OPEN,
          () => openFilesystemEntry(entries[0] ?? entry),
          entries.length !== 1,
        ),
        contextMenuCommand(
          XP_CONTEXT_MENU_COMMAND_ID.DOWNLOAD,
          FILESYSTEM_COPY.DOWNLOAD,
          () => download.start(entries),
          entries.every((candidate) => candidate.kind === FILESYSTEM_ENTRY_KIND.WIDGET),
        ),
        contextMenuSeparator("desktop-entry-separator-1"),
        contextMenuCommand(
          XP_CONTEXT_MENU_COMMAND_ID.RENAME,
          FILESYSTEM_COPY.RENAME,
          () => setDesktopDialog({ kind: "rename", entries }),
          entries.length !== 1,
        ),
        contextMenuCommand(
          XP_CONTEXT_MENU_COMMAND_ID.MOVE,
          FILESYSTEM_COPY.MOVE,
          () => setDesktopDialog({ kind: "move", entries }),
        ),
        contextMenuCommand(
          XP_CONTEXT_MENU_COMMAND_ID.TRASH,
          FILESYSTEM_COPY.DELETE,
          () => trashDesktopEntries(entries),
        ),
        ...(directory
          ? [
              contextMenuSeparator("desktop-entry-separator-2"),
              contextMenuCommand(
                XP_CONTEXT_MENU_COMMAND_ID.PROPERTIES,
                FOLDER_PROPERTIES_COPY.PROPERTIES,
                () => folderProperties.open(directory),
              ),
            ]
          : []),
      ], FILESYSTEM_COPY.CONTEXT_MENU);
    },
    [
      contextMenu,
      desktopSelection,
      download,
      folderProperties,
      openFilesystemEntry,
      selectedDesktopEntries,
      trashDesktopEntries,
    ],
  );

  const openBlankDesktopMenu = useCallback(
    (event: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }): void => {
      contextMenu.openFromEvent(event, [
        contextMenuCommand(
          XP_CONTEXT_MENU_COMMAND_ID.NEW_FOLDER,
          FILESYSTEM_COPY.NEW_FOLDER,
          () => setDesktopDialog({ kind: "create" }),
        ),
        contextMenuSeparator("desktop-blank-separator-1"),
        contextMenuCommand(
          XP_CONTEXT_MENU_COMMAND_ID.ADD_MEMO,
          DASHBOARD_COPY.ADD_MEMO_WIDGET,
          () => addWidget(WIDGET_TYPE.MEMO),
        ),
        contextMenuCommand(
          XP_CONTEXT_MENU_COMMAND_ID.ADD_CHECKLIST,
          DASHBOARD_COPY.ADD_CHECKLIST_WIDGET,
          () => addWidget(WIDGET_TYPE.DAILY_CHECKLIST),
        ),
        contextMenuCommand(
          XP_CONTEXT_MENU_COMMAND_ID.ADD_STORAGE_STATUS,
          DASHBOARD_COPY.ADD_STORAGE_STATUS_WIDGET,
          () => addWidget(WIDGET_TYPE.STORAGE_STATUS),
        ),
        contextMenuSeparator("desktop-blank-separator-2"),
        contextMenuCommand(
          XP_CONTEXT_MENU_COMMAND_ID.REFRESH,
          FILESYSTEM_COPY.REFRESH,
          notifyFilesystemChanged,
        ),
      ]);
    },
    [addWidget, contextMenu, notifyFilesystemChanged],
  );

  const runDesktopDialogChange = useCallback(
    async (operation: () => Promise<void>): Promise<void> => {
      setDesktopDialogBusy(true);
      setDesktopError(null);
      try {
        await operation();
        setDesktopDialog(null);
        notifyFilesystemChanged();
      } catch (error) {
        setDesktopError(messageFromError(error, FILESYSTEM_COPY.CHANGE_FAILED));
      } finally {
        setDesktopDialogBusy(false);
      }
    },
    [notifyFilesystemChanged],
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
          const result = await filesystemGateway.trashEntries(payload.ids);
          removeWidgetWindows(result.closedWidgetIds);
          setBatchResult(result.failures.length > 0 ? result : null);
          desktopSelection.replace(
            result.failures.map((failure) => failure.id),
          );
        });
        return;
      }
      handleDrop(event, FILESYSTEM_ROOT_ID.DOCUMENTS);
    },
    [
      desktopSelection.replace,
      filesystemGateway,
      handleDrop,
      removeWidgetWindows,
      runFilesystemChange,
    ],
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

  const activateTaskbarWindow = windowManager.activate;
  const restoreManagedWindow = windowManager.restore;
  const minimizeManagedWindow = windowManager.minimize;
  const maximizeManagedWindow = windowManager.toggleMaximize;

  const closeManagedWindow = useCallback(
    (id: string): void => {
      if (explorer.windows.some((window) => window.id === id)) {
        explorer.close(id);
      } else if (isSystemAppId(id)) {
        system.close(id);
      } else if (media.windows.some((window) => window.id === id)) {
        media.close(id);
      } else if (widgets.some((widget) => widget.id === id)) {
        widgetFiles.requestClose(id);
      }
      windowManager.clearActive(id);
    },
    [explorer, media, system, widgetFiles, widgets, windowManager],
  );
  const taskbarWindows = windowManager.taskbarWindows;

  const desktopStyle = {
    ...DESKTOP_BACKGROUND_STYLE,
    "--desktop-shortcut-row-count": iconLayout.rowCount,
  } as CSSProperties;

  return (
    <div
      className="desktop-shell"
      style={desktopStyle}
      onContextMenu={(event) =>
        contextMenu.openFromEvent(event, [
          contextMenuCommand(
            XP_CONTEXT_MENU_COMMAND_ID.STORAGE_STATUS,
            XP_CONTEXT_MENU_COPY.STORAGE_STATUS,
            () => addWidget(WIDGET_TYPE.STORAGE_STATUS),
          ),
          contextMenuCommand(
            XP_CONTEXT_MENU_COMMAND_ID.REFRESH_PAGE,
            XP_CONTEXT_MENU_COPY.REFRESH_PAGE,
            () => window.location.reload(),
          ),
        ])
      }
    >
      <main
        ref={workAreaRef}
        className="desktop-work-area"
        data-drop-target={isDesktopDropTarget}
        aria-label={DASHBOARD_COPY.DESKTOP}
        onPointerDown={(event) => {
          closeStartMenu();
          contextMenu.close();
          if (event.target === event.currentTarget) {
            setSelectedSystemShortcutId(null);
          }
          desktopMarquee.onPointerDown(event);
        }}
        onPointerMove={desktopMarquee.onPointerMove}
        onPointerUp={desktopMarquee.onPointerUp}
        onPointerCancel={desktopMarquee.onPointerCancel}
        onKeyDown={(event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLocaleLowerCase() === KEYBOARD_KEY.A
          ) {
            event.preventDefault();
            setSelectedSystemShortcutId(null);
            desktopSelection.selectAll();
          } else if (event.key === KEYBOARD_KEY.ESCAPE) {
            setSelectedSystemShortcutId(null);
            desktopSelection.clear();
            contextMenu.close();
          }
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
        onContextMenu={(event) => {
          if (event.target === event.currentTarget) openBlankDesktopMenu(event);
        }}
      >
        <DesktopShortcuts
          entries={visibleDesktopEntries}
          selectedSystemId={selectedSystemShortcutId}
          selectedEntryIds={desktopSelection.selectedIds}
          thumbnailUrl={(id) => filesystemGateway.thumbnailUrl(id)}
          onSelectSystem={(id) => {
            desktopSelection.clear();
            setSelectedSystemShortcutId(id);
            contextMenu.close();
          }}
          onSelectEntry={(id, event) => {
            setSelectedSystemShortcutId(null);
            contextMenu.close();
            desktopSelection.select(id, event);
          }}
          onOpenSystem={openSystemShortcut}
          onOpenEntry={openFilesystemEntry}
          onDragEntry={(entry, event) => {
            const ids = desktopSelection.dragIds(entry.id);
            desktopSelection.replace(ids);
            writeFilesystemDragPayload(event.dataTransfer, {
              ids,
              primaryId: entry.id,
              source: FILESYSTEM_DRAG_SOURCE.ACTIVE,
            });
          }}
          onDropSystem={dropOnSystemApp}
          onDropEntry={dropOnEntry}
          onContextMenuEntry={openDesktopEntryMenu}
          onShowEntryProperties={(entry) => {
            if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
              folderProperties.open(entry);
            }
          }}
          onShowSystemProperties={(id) => {
            if (id === SYSTEM_APP_ID.DOCUMENTS) {
              folderProperties.open({
                id: FILESYSTEM_ROOT_ID.DOCUMENTS,
                name: FILESYSTEM_ROOT_NAME.DOCUMENTS,
              });
            }
          }}
          onContextMenuSystem={(id, event) => {
            setSelectedSystemShortcutId(id);
            desktopSelection.clear();
            contextMenu.openFromEvent(event, [
              contextMenuCommand(
                XP_CONTEXT_MENU_COMMAND_ID.OPEN,
                FILESYSTEM_COPY.OPEN,
                () => openSystemShortcut(id),
              ),
              ...(id === SYSTEM_APP_ID.DOCUMENTS
                ? [
                    contextMenuSeparator("desktop-system-separator-1"),
                    contextMenuCommand(
                      XP_CONTEXT_MENU_COMMAND_ID.PROPERTIES,
                      FOLDER_PROPERTIES_COPY.PROPERTIES,
                      () =>
                        folderProperties.open({
                          id: FILESYSTEM_ROOT_ID.DOCUMENTS,
                          name: FILESYSTEM_ROOT_NAME.DOCUMENTS,
                        }),
                    ),
                  ]
                : []),
            ]);
          }}
        />
        <FilesystemSelectionMarquee bounds={desktopMarquee.bounds} />
        {widgets.length === 0 &&
        desktopEntries.entries.length === 0 &&
        media.windows.length === 0 &&
        explorer.windows.length === 0 &&
        !SYSTEM_APP_ID_VALUES.some((id) => system.windows[id].isOpen) ? (
          <p className="desktop-empty-hint">{DASHBOARD_COPY.EMPTY_DESKTOP}</p>
        ) : null}
        <DesktopWindowLayer
          desktop={desktop}
          widgets={widgets}
          activeWindowId={activeWindowId}
          zOrders={zOrders}
          gateway={gateway}
          filesystemGateway={filesystemGateway}
          storageStatusGateway={storageStatusGateway}
          explorer={explorer}
          system={system}
          media={media}
          desktopCapacity={iconLayout.dynamicCapacity}
          filesystemRevision={filesystemRevision}
          onFilesystemChanged={notifyFilesystemChanged}
          onOpenMedia={openMediaViewer}
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
          onFocusWindow={focusDesktopWindow}
          onClearActive={windowManager.clearActive}
          onRequestWidgetClose={widgetFiles.requestClose}
          onFocusWidget={onFocusWindow}
          onMinimizeWidget={onMinimizeWindow}
          onToggleMaximizeWidget={onToggleMaximizeWindow}
          onCommitWidgetBounds={onCommitWindowBounds}
          onWidgetChange={onWidgetChange}
          onSaveWidgetFile={widgetFiles.beginSave}
          onAddWidget={addWidget}
        />
      </main>

      <DesktopDialogLayer
        gateway={filesystemGateway}
        widgets={widgets}
        dialog={desktopDialog}
        dialogBusy={desktopDialogBusy}
        widgetFiles={widgetFiles}
        upload={upload}
        download={download}
        batchResult={batchResult}
        folderProperties={folderProperties}
        onCreate={(name) =>
          void runDesktopDialogChange(async () => {
            await filesystemGateway.createDirectory(
              FILESYSTEM_ROOT_ID.DESKTOP,
              name,
              desktopPlacement(),
            );
          })
        }
        onRename={(name) => {
          if (desktopDialog?.kind !== "rename" || !desktopDialog.entries[0]) return;
          void runDesktopDialogChange(async () => {
            synchronizeWidgetFile(
              await filesystemGateway.updateEntry(desktopDialog.entries[0]!.id, { name }),
            );
          });
        }}
        onMove={(parentId) => {
          if (desktopDialog?.kind !== "move") return;
          void runDesktopDialogChange(async () => {
            const result = await filesystemGateway.moveEntries(
              desktopDialog.entries.map((entry) => entry.id),
              {
                parentId,
                ...(parentId === FILESYSTEM_ROOT_ID.DESKTOP
                  ? { desktopPlacement: desktopPlacement() }
                  : {}),
              },
            );
            result.entries.forEach(synchronizeWidgetFile);
            removeWidgetWindows(result.closedWidgetIds);
            setBatchResult(result.failures.length > 0 ? result : null);
          });
        }}
        onCloseDialog={() => setDesktopDialog(null)}
        onCloseBatchResult={() => setBatchResult(null)}
      />

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
        onAddStorageStatus={() => addWidget(WIDGET_TYPE.STORAGE_STATUS)}
      />
      <Taskbar
        windows={taskbarWindows}
        isStartMenuOpen={isStartMenuOpen}
        saveStatus={layoutSaveStatus}
        onToggleStartMenu={() => setIsStartMenuOpen((current) => !current)}
        onActivateWindow={activateTaskbarWindow}
        onRestoreWindow={restoreManagedWindow}
        onMinimizeWindow={minimizeManagedWindow}
        onToggleMaximizeWindow={maximizeManagedWindow}
        onCloseWindow={closeManagedWindow}
      />
    </div>
  );
}

function isSystemAppId(id: string): id is SystemAppId {
  return (SYSTEM_APP_ID_VALUES as readonly string[]).includes(id);
}
