import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { SystemAppId } from "@client/types/desktop/system-app";
import type { DesktopShellProps } from "@client/types/desktop/desktop";
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
  SYSTEM_APP_ID,
  SYSTEM_APP_ID_VALUES,
} from "@client/constants/desktop/system-app";
import { FILESYSTEM_COPY, FILESYSTEM_DRAG_SOURCE } from "@client/constants/filesystem/filesystem";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { writeFilesystemDragPayload } from "@client/domain/filesystem/drag";
import { useDesktopDimensions } from "@client/hooks/desktop/use-desktop-dimensions";
import { useDesktopFilesystemController } from "@client/hooks/desktop/filesystem/use-desktop-filesystem-controller";
import { useDesktopContextMenus } from "@client/hooks/desktop/shell/use-desktop-context-menus";
import { useDesktopLauncher } from "@client/hooks/desktop/shell/use-desktop-launcher";
import { useDesktopWindowManager } from "@client/hooks/desktop/use-desktop-window-manager";
import { useExplorerWindows } from "@client/hooks/desktop/use-explorer-windows";
import { useSystemWindows } from "@client/hooks/desktop/use-system-windows";
import { useMediaWindows } from "@client/hooks/media/use-media-windows";
import { useWidgetFileLifecycle } from "@client/hooks/widgets/use-widget-file-lifecycle";
import { DesktopDialogLayer } from "@client/components/desktop/desktop-dialog-layer";
import { DesktopNotification } from "@client/components/desktop/desktop-notification";
import { DesktopShortcuts } from "@client/components/desktop/desktop-shortcuts";
import { DesktopWindowLayer } from "@client/components/desktop/desktop-window-layer";
import { StartMenu } from "@client/components/desktop/start-menu";
import { Taskbar } from "@client/components/desktop/taskbar";
import { FilesystemSelectionMarquee } from "@client/components/filesystem/filesystem-selection-marquee";

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

export function DesktopShell(props: DesktopShellProps) {
  const {
    session,
    widgets,
    activeWidgetId,
    gateway,
    filesystemGateway,
    storageStatusGateway,
    layoutSaveStatus,
    layoutSaveError,
    message,
  } = props;
  const workAreaRef = useRef<HTMLElement>(null);
  const desktop = useDesktopDimensions(workAreaRef);
  const system = useSystemWindows();
  const media = useMediaWindows();
  const explorer = useExplorerWindows();
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [selectedSystemShortcutId, setSelectedSystemShortcutId] =
    useState<SystemAppId | null>(null);
  const [dismissedOverflowCount, setDismissedOverflowCount] = useState<number | null>(null);
  const windowManager = useDesktopWindowManager({
    activeWidgetId,
    widgets,
    explorer,
    system,
    media,
    onActivateWidget: props.onActivateTaskbarWindow,
    onFocusWidget: props.onFocusWindow,
    onMinimizeWidget: props.onMinimizeWindow,
    onToggleMaximizeWidget: props.onToggleMaximizeWindow,
  });
  const filesystem = useDesktopFilesystemController({
    gateway: filesystemGateway,
    workAreaRef,
    desktop,
    widgets,
    onWidgetChange: props.onWidgetChange,
    onRemoveWidgets: props.onRemoveWidgets,
    onWindowClosed: windowManager.clearActive,
  });
  const closeStartMenu = useCallback(() => setIsStartMenuOpen(false), []);
  const launcher = useDesktopLauncher({
    desktop,
    system,
    explorer,
    media,
    filesystem: filesystemGateway,
    focusWindow: windowManager.focus,
    closeStartMenu,
    onAddWidget: props.onAddWidget,
    onOpenWidget: props.onOpenWidget,
  });
  const menus = useDesktopContextMenus({
    selectedEntries: filesystem.selectedEntries,
    selection: filesystem.selection,
    download: filesystem.download,
    folderProperties: filesystem.folderProperties,
    setDialog: filesystem.setDialog,
    trashEntries: filesystem.trashEntries,
    notifyFilesystemChanged: filesystem.notifyChanged,
    openFilesystemEntry: launcher.openFilesystemEntry,
    openSystemShortcut: launcher.openSystemShortcut,
    addWidget: launcher.addWidget,
    setSelectedSystemShortcutId,
  });
  const widgetFiles = useWidgetFileLifecycle({
    widgets,
    desktopPlacement: filesystem.desktopPlacement,
    onSaveFile: props.onSaveWidgetFile,
    onClose: props.onCloseWidget,
    onDiscard: props.onDiscardWidget,
    onFilesystemChanged: filesystem.notifyChanged,
    onWindowClosed: windowManager.clearActive,
    onError: filesystem.reportError,
  });

  useEffect(() => {
    setDismissedOverflowCount(null);
  }, [desktop.width, desktop.height, filesystem.entries.entries.length]);

  const closeManagedWindow = useCallback(
    (id: string): void => {
      if (explorer.windows.some((window) => window.id === id)) explorer.close(id);
      else if (isSystemAppId(id)) system.close(id);
      else if (media.windows.some((window) => window.id === id)) media.close(id);
      else if (widgets.some((widget) => widget.id === id)) widgetFiles.requestClose(id);
      windowManager.clearActive(id);
    },
    [explorer, media, system, widgetFiles, widgets, windowManager],
  );
  const desktopStyle = {
    ...DESKTOP_BACKGROUND_STYLE,
    "--desktop-shortcut-row-count": filesystem.iconLayout.rowCount,
  } as CSSProperties;

  return (
    <div className="desktop-shell" style={desktopStyle} onContextMenu={menus.openRootMenu}>
      <main
        ref={workAreaRef}
        className="desktop-work-area"
        data-drop-target={filesystem.isDropTarget}
        aria-label={DASHBOARD_COPY.DESKTOP}
        onPointerDown={(event) => {
          closeStartMenu();
          menus.contextMenu.close();
          if (event.target === event.currentTarget) setSelectedSystemShortcutId(null);
          filesystem.marquee.onPointerDown(event);
        }}
        onPointerMove={filesystem.marquee.onPointerMove}
        onPointerUp={filesystem.marquee.onPointerUp}
        onPointerCancel={filesystem.marquee.onPointerCancel}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === KEYBOARD_KEY.A) {
            event.preventDefault();
            setSelectedSystemShortcutId(null);
            filesystem.selection.selectAll();
          } else if (event.key === KEYBOARD_KEY.ESCAPE) {
            setSelectedSystemShortcutId(null);
            filesystem.selection.clear();
            menus.contextMenu.close();
          }
        }}
        onDragEnter={(event) => {
          if (event.target === event.currentTarget) filesystem.setIsDropTarget(true);
        }}
        onDragLeave={(event) => {
          if (event.target === event.currentTarget) filesystem.setIsDropTarget(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          filesystem.setIsDropTarget(false);
          filesystem.handleDrop(event, FILESYSTEM_ROOT_ID.DESKTOP);
        }}
        onContextMenu={(event) => {
          if (event.target === event.currentTarget) menus.openBlankMenu(event);
        }}
      >
        <DesktopShortcuts
          entries={filesystem.visibleEntries}
          selectedSystemId={selectedSystemShortcutId}
          selectedEntryIds={filesystem.selection.selectedIds}
          thumbnailUrl={filesystemGateway.thumbnailUrl.bind(filesystemGateway)}
          onSelectSystem={(id) => {
            filesystem.selection.clear();
            setSelectedSystemShortcutId(id);
            menus.contextMenu.close();
          }}
          onSelectEntry={(id, event) => {
            setSelectedSystemShortcutId(null);
            menus.contextMenu.close();
            filesystem.selection.select(id, event);
          }}
          onOpenSystem={launcher.openSystemShortcut}
          onOpenEntry={launcher.openFilesystemEntry}
          onDragEntry={(entry, event) => {
            const ids = filesystem.selection.dragIds(entry.id);
            filesystem.selection.replace(ids);
            writeFilesystemDragPayload(event.dataTransfer, {
              ids,
              primaryId: entry.id,
              source: FILESYSTEM_DRAG_SOURCE.ACTIVE,
            });
          }}
          onDropSystem={filesystem.dropOnSystemApp}
          onDropEntry={filesystem.dropOnEntry}
          onContextMenuEntry={menus.openEntryMenu}
          onShowEntryProperties={(entry) => {
            if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
              filesystem.folderProperties.open(entry);
            }
          }}
          onShowSystemProperties={(id) => {
            if (id === SYSTEM_APP_ID.DOCUMENTS) {
              filesystem.folderProperties.open({
                id: FILESYSTEM_ROOT_ID.DOCUMENTS,
                name: FILESYSTEM_ROOT_NAME.DOCUMENTS,
              });
            }
          }}
          onContextMenuSystem={menus.openSystemMenu}
        />
        <FilesystemSelectionMarquee bounds={filesystem.marquee.bounds} />
        {widgets.length === 0 &&
        filesystem.entries.entries.length === 0 &&
        media.windows.length === 0 &&
        explorer.windows.length === 0 &&
        !SYSTEM_APP_ID_VALUES.some((id) => system.windows[id].isOpen) ? (
          <p className="desktop-empty-hint">{DASHBOARD_COPY.EMPTY_DESKTOP}</p>
        ) : null}
        <DesktopWindowLayer
          desktop={desktop}
          widgets={widgets}
          activeWindowId={windowManager.activeWindowId}
          zOrders={windowManager.zOrders}
          gateway={gateway}
          filesystemGateway={filesystemGateway}
          storageStatusGateway={storageStatusGateway}
          explorer={explorer}
          system={system}
          media={media}
          desktopCapacity={filesystem.iconLayout.dynamicCapacity}
          filesystemRevision={filesystem.revision}
          onFilesystemChanged={filesystem.notifyChanged}
          onOpenMedia={launcher.openMediaViewer}
          onOpenWidget={(widgetId) => void props.onOpenWidget(widgetId)}
          onEntryChanged={filesystem.synchronizeWidgetFile}
          onWidgetsClosed={filesystem.removeWidgetWindows}
          onUploadNodes={filesystem.uploadNodes}
          onFocusWindow={windowManager.focus}
          onClearActive={windowManager.clearActive}
          onRequestWidgetClose={widgetFiles.requestClose}
          onFocusWidget={props.onFocusWindow}
          onMinimizeWidget={props.onMinimizeWindow}
          onToggleMaximizeWidget={props.onToggleMaximizeWindow}
          onCommitWidgetBounds={props.onCommitWindowBounds}
          onWidgetChange={props.onWidgetChange}
          onSaveWidgetFile={widgetFiles.beginSave}
          onAddWidget={launcher.addWidget}
        />
      </main>
      <DesktopDialogLayer
        gateway={filesystemGateway}
        widgets={widgets}
        dialog={filesystem.dialog}
        dialogBusy={filesystem.dialogBusy}
        widgetFiles={widgetFiles}
        upload={filesystem.upload}
        download={filesystem.download}
        batchResult={filesystem.batchResult}
        folderProperties={filesystem.folderProperties}
        onCreate={filesystem.createDirectory}
        onRename={filesystem.renameEntry}
        onMove={filesystem.moveDialogEntries}
        onCloseDialog={() => filesystem.setDialog(null)}
        onCloseBatchResult={() => filesystem.setBatchResult(null)}
      />
      {layoutSaveStatus === LAYOUT_SAVE_STATUS.ERROR && layoutSaveError ? (
        <DesktopNotification
          title={DASHBOARD_COPY.SAVE_FAILED}
          message={layoutSaveError}
          actionLabel={DASHBOARD_COPY.RETRY}
          onAction={props.onRetrySave}
        />
      ) : filesystem.error || filesystem.entries.error ? (
        <DesktopNotification
          title={SITE_COPY.TITLE}
          message={filesystem.error ?? filesystem.entries.error ?? FILESYSTEM_COPY.LOAD_FAILED}
          actionLabel={DASHBOARD_COPY.CONFIRM}
          onAction={filesystem.clearError}
        />
      ) : message ? (
        <DesktopNotification
          title={SITE_COPY.TITLE}
          message={message.text}
          actionLabel={DASHBOARD_COPY.CONFIRM}
          onAction={props.onDismissMessage}
        />
      ) : filesystem.overflowCount > 0 && dismissedOverflowCount !== filesystem.overflowCount ? (
        <DesktopNotification
          title={SITE_COPY.TITLE}
          message={FILESYSTEM_COPY.DESKTOP_OVERFLOW(filesystem.overflowCount)}
          actionLabel={FILESYSTEM_COPY.OPEN_DESKTOP}
          onAction={() => {
            setDismissedOverflowCount(filesystem.overflowCount);
            launcher.openDocumentsDirectory(
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
        onAddMemo={() => launcher.addWidget(WIDGET_TYPE.MEMO)}
        onAddChecklist={() => launcher.addWidget(WIDGET_TYPE.DAILY_CHECKLIST)}
        onAddStorageStatus={() => launcher.addWidget(WIDGET_TYPE.STORAGE_STATUS)}
      />
      <Taskbar
        windows={windowManager.taskbarWindows}
        isStartMenuOpen={isStartMenuOpen}
        saveStatus={layoutSaveStatus}
        onToggleStartMenu={() => setIsStartMenuOpen((current) => !current)}
        onActivateWindow={windowManager.activate}
        onRestoreWindow={windowManager.restore}
        onMinimizeWindow={windowManager.minimize}
        onToggleMaximizeWindow={windowManager.toggleMaximize}
        onCloseWindow={closeManagedWindow}
      />
    </div>
  );
}

function isSystemAppId(id: string): id is SystemAppId {
  return (SYSTEM_APP_ID_VALUES as readonly string[]).includes(id);
}
