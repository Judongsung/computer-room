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
import {
  WIDGET_BEHAVIOR,
  WIDGET_TYPE,
  WINDOW_STATE,
} from "../../../constants/widget";
import { mediaKindFromContentType } from "../../../domain/media-type";
import type { FilesystemEntry } from "../../../types/filesystem";
import type { FilesystemBatchResult } from "../../../types/filesystem-batch";
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
import { KEYBOARD_KEY } from "../../constants/keyboard";
import { useDesktopDimensions } from "../../hooks/use-desktop-dimensions";
import { useSystemWindows } from "../../hooks/use-system-windows";
import { useMediaWindows } from "../../hooks/use-media-windows";
import { useExplorerWindows } from "../../hooks/use-explorer-windows";
import { useDesktopEntries } from "../../hooks/use-desktop-entries";
import { useFilesystemUpload } from "../../hooks/use-filesystem-upload";
import { useFilesystemSelection } from "../../hooks/use-filesystem-selection";
import { useFilesystemMarqueeSelection } from "../../hooks/use-filesystem-marquee-selection";
import { useFilesystemDownload } from "../../hooks/use-filesystem-download";
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
import { DownloadTransferDialog } from "../filesystem/download-transfer-dialog";
import { FilesystemBatchResultDialog } from "../filesystem/filesystem-batch-result-dialog";
import { FilesystemSelectionMarquee } from "../filesystem/filesystem-selection-marquee";
import {
  UnsavedWidgetDialog,
  WidgetSaveDialog,
} from "../filesystem/widget-file-dialogs";
import {
  DirectoryPickerDialog,
  NameDialog,
} from "../filesystem/filesystem-dialogs";
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
import { useXpContextMenu } from "../../state/context-menu-context";
import {
  contextMenuCommand,
  contextMenuSeparator,
} from "../../domain/context-menu";
import {
  XP_CONTEXT_MENU_COMMAND_ID,
  XP_CONTEXT_MENU_COPY,
} from "../../constants/context-menu";

type DesktopFilesystemDialog =
  | { readonly kind: "create" }
  | { readonly kind: "rename"; readonly entries: readonly FilesystemEntry[] }
  | { readonly kind: "move"; readonly entries: readonly FilesystemEntry[] }
  | null;

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
  const [activeWindowId, setActiveWindowId] = useState<string | null>(activeWidgetId);
  const [zOrders, setZOrders] = useState<Readonly<Record<string, number>>>({});
  const [filesystemRevision, setFilesystemRevision] = useState(0);
  const [saveWidgetId, setSaveWidgetId] = useState<string | null>(null);
  const [closePromptWidgetId, setClosePromptWidgetId] = useState<string | null>(null);
  const [closeAfterSaveWidgetId, setCloseAfterSaveWidgetId] = useState<string | null>(null);
  const [widgetDialogBusy, setWidgetDialogBusy] = useState(false);
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
  const desktopEntryIds = useMemo(
    () => visibleDesktopEntries.map((entry) => entry.id),
    [visibleDesktopEntries],
  );
  const desktopSelection = useFilesystemSelection(desktopEntryIds);
  const desktopMarquee = useFilesystemMarqueeSelection(
    workAreaRef,
    desktopSelection.selectedIds,
    desktopSelection.replace,
  );
  const download = useFilesystemDownload(filesystemGateway);
  const selectedDesktopEntries = useMemo(
    () =>
      visibleDesktopEntries.filter((entry) =>
        desktopSelection.selectedIds.has(entry.id),
      ),
    [desktopSelection.selectedIds, visibleDesktopEntries],
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
          setDesktopError(errorMessage(error, FILESYSTEM_COPY.CHANGE_FAILED)),
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
      ], FILESYSTEM_COPY.CONTEXT_MENU);
    },
    [
      contextMenu,
      desktopSelection,
      download,
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
        setDesktopError(errorMessage(error, FILESYSTEM_COPY.CHANGE_FAILED));
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

  const requestWidgetClose = useCallback(
    (widgetId: string): void => {
      const widget = widgets.find((candidate) => candidate.id === widgetId);
      if (!widget) return;
      if (!widget.file && !WIDGET_BEHAVIOR[widget.type].persistsWithoutFile) {
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

  const restoreManagedWindow = useCallback(
    (id: string): void => {
      const explorerWindow = explorer.windows.find((window) => window.id === id);
      if (explorerWindow) {
        if (explorerWindow.windowState === WINDOW_STATE.MAXIMIZED) {
          explorer.toggleMaximize(id);
        } else {
          explorer.restore(id);
        }
        focusDesktopWindow(id);
        return;
      }
      if (isSystemAppId(id)) {
        if (system.windows[id].windowState === WINDOW_STATE.MAXIMIZED) {
          system.toggleMaximize(id);
        } else {
          system.restore(id);
        }
        focusDesktopWindow(id);
        return;
      }
      const mediaWindow = media.windows.find((window) => window.id === id);
      if (mediaWindow) {
        if (mediaWindow.windowState === WINDOW_STATE.MAXIMIZED) {
          media.toggleMaximize(id);
        } else {
          media.restore(id);
        }
        focusDesktopWindow(id);
        return;
      }
      const widget = widgets.find((candidate) => candidate.id === id);
      if (!widget) return;
      if (widget.windowState === WINDOW_STATE.MAXIMIZED) {
        onToggleMaximizeWindow(id);
      } else if (widget.windowState === WINDOW_STATE.MINIMIZED) {
        onActivateTaskbarWindow(id);
      }
      focusDesktopWindow(id, () => onFocusWindow(id));
    },
    [
      explorer,
      focusDesktopWindow,
      media,
      onActivateTaskbarWindow,
      onFocusWindow,
      onToggleMaximizeWindow,
      system,
      widgets,
    ],
  );

  const minimizeManagedWindow = useCallback(
    (id: string): void => {
      if (explorer.windows.some((window) => window.id === id)) {
        explorer.minimize(id);
      } else if (isSystemAppId(id)) {
        system.minimize(id);
      } else if (media.windows.some((window) => window.id === id)) {
        media.minimize(id);
      } else if (widgets.some((widget) => widget.id === id)) {
        onMinimizeWindow(id);
      }
      setActiveWindowId((current) => (current === id ? null : current));
    },
    [explorer, media, onMinimizeWindow, system, widgets],
  );

  const maximizeManagedWindow = useCallback(
    (id: string): void => {
      if (explorer.windows.some((window) => window.id === id)) {
        explorer.toggleMaximize(id);
      } else if (isSystemAppId(id)) {
        system.toggleMaximize(id);
      } else if (media.windows.some((window) => window.id === id)) {
        media.toggleMaximize(id);
      } else if (widgets.some((widget) => widget.id === id)) {
        onToggleMaximizeWindow(id);
      } else {
        return;
      }
      focusDesktopWindow(id);
    },
    [explorer, focusDesktopWindow, media, onToggleMaximizeWindow, system, widgets],
  );

  const closeManagedWindow = useCallback(
    (id: string): void => {
      if (explorer.windows.some((window) => window.id === id)) {
        explorer.close(id);
      } else if (isSystemAppId(id)) {
        system.close(id);
      } else if (media.windows.some((window) => window.id === id)) {
        media.close(id);
      } else if (widgets.some((widget) => widget.id === id)) {
        requestWidgetClose(id);
      }
      setActiveWindowId((current) => (current === id ? null : current));
    },
    [explorer, media, requestWidgetClose, system, widgets],
  );

  const taskbarWindows = useMemo<readonly TaskbarWindowItem[]>(
    () => [
      ...widgets.map((widget) => ({
        id: widget.id,
        title: widget.file?.name ?? unsavedWidgetTitle(widget.type),
        iconPath: WIDGET_ICON_PATH_BY_TYPE[widget.type],
        isActive: activeWindowId === widget.id,
        isMinimized: widget.windowState === WINDOW_STATE.MINIMIZED,
        isMaximized: widget.windowState === WINDOW_STATE.MAXIMIZED,
      })),
      ...SYSTEM_APP_ID_VALUES.filter((id) => system.windows[id].isOpen).map((id) => ({
        id,
        title: SYSTEM_APP_CONFIG[id].title,
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
          title: `${window.currentFile.name} - ${config.titleSuffix}`,
          iconPath: config.iconPath,
          isActive: activeWindowId === window.id,
          isMinimized: window.windowState === WINDOW_STATE.MINIMIZED,
          isMaximized: window.windowState === WINDOW_STATE.MAXIMIZED,
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
          onContextMenuSystem={(id, event) => {
            setSelectedSystemShortcutId(id);
            desktopSelection.clear();
            contextMenu.openFromEvent(event, [
              contextMenuCommand(
                XP_CONTEXT_MENU_COMMAND_ID.OPEN,
                FILESYSTEM_COPY.OPEN,
                () => openSystemShortcut(id),
              ),
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
        {widgets.map((widget) => (
          <DesktopWindow
            key={widget.id}
            widget={widget}
            desktop={desktop}
            isActive={widget.id === activeWindowId}
            zIndex={desktopWindowZIndex(widget.id, zOrders, widget.stackOrder)}
            gateway={gateway}
            storageStatusGateway={storageStatusGateway}
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

      {desktopDialog?.kind === "create" ? (
        <NameDialog
          title={FILESYSTEM_COPY.CREATE_FOLDER_TITLE}
          label={FILESYSTEM_COPY.FOLDER_NAME}
          busy={desktopDialogBusy}
          onSubmit={(name) =>
            void runDesktopDialogChange(async () => {
              await filesystemGateway.createDirectory(
                FILESYSTEM_ROOT_ID.DESKTOP,
                name,
                desktopPlacement(),
              );
            })
          }
          onCancel={() => setDesktopDialog(null)}
        />
      ) : null}
      {desktopDialog?.kind === "rename" && desktopDialog.entries[0] ? (
        <NameDialog
          title={FILESYSTEM_COPY.RENAME_TITLE}
          label={FILESYSTEM_COPY.ENTRY_NAME}
          initialValue={desktopDialog.entries[0].name}
          busy={desktopDialogBusy}
          onSubmit={(name) =>
            void runDesktopDialogChange(async () => {
              synchronizeWidgetFile(
                await filesystemGateway.updateEntry(
                  desktopDialog.entries[0]!.id,
                  { name },
                ),
              );
            })
          }
          onCancel={() => setDesktopDialog(null)}
        />
      ) : null}
      {desktopDialog?.kind === "move" ? (
        <DirectoryPickerDialog
          gateway={filesystemGateway}
          excludedEntryIds={desktopDialog.entries
            .filter((entry) => entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY)
            .map((entry) => entry.id)}
          busy={desktopDialogBusy}
          onSelect={(parentId) =>
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
            })
          }
          onCancel={() => setDesktopDialog(null)}
        />
      ) : null}

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
      <DownloadTransferDialog
        state={download.state}
        onCancel={download.cancel}
        onClose={download.close}
      />
      <FilesystemBatchResultDialog
        result={batchResult}
        onClose={() => setBatchResult(null)}
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
