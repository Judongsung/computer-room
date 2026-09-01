import "xp.css/dist/XP.css";
import "@client/styles/desktop.css";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "@/constants/filesystem/filesystem";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import {
  DESKTOP_ASSET_PATHS,
  DESKTOP_LAYOUT,
} from "@client/constants/desktop/desktop";
import { LAYOUT_SAVE_STATUS } from "@client/constants/desktop/layout-save";
import { PROJECT_EXTERNAL_LINKS } from "@client/constants/platform/external-links";
import { XP_CONTEXT_MENU_COMMAND_ID } from "@client/constants/context-menu/context-menu";
import { GUEST_DESKTOP_LAYOUT } from "@client/constants/guest/guest";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { contextMenuCommand } from "@client/domain/context-menu/context-menu";
import { desktopIconLayout } from "@client/domain/desktop/desktop-icon-layout";
import { useDesktopDimensions } from "@client/hooks/desktop/use-desktop-dimensions";
import { useDesktopWindowManager } from "@client/hooks/desktop/use-desktop-window-manager";
import { useExplorerWindows } from "@client/hooks/desktop/use-explorer-windows";
import { useSystemWindows } from "@client/hooks/desktop/use-system-windows";
import { useGuestProgramWindows } from "@client/hooks/guest/use-guest-program-windows";
import { useMediaWindows } from "@client/hooks/media/use-media-windows";
import { useDesktopEntries } from "@client/hooks/filesystem/use-desktop-entries";
import { GuestDesktopShortcuts } from "@client/components/desktop/guest/guest-desktop-shortcuts";
import { GuestExplorerWindow } from "@client/components/desktop/guest/guest-explorer-window";
import { GuestProgramWindow } from "@client/components/desktop/guest/guest-program-window";
import { GuestStartMenu } from "@client/components/desktop/guest/guest-start-menu";
import { DesktopNotification } from "@client/components/desktop/desktop-notification";
import { MediaViewerWindow } from "@client/components/media/media-viewer-window";
import { Taskbar } from "@client/components/desktop/taskbar";
import { XpWindowFrame } from "@client/components/desktop/xp-window-frame";
import { ThumbnailLoadProvider } from "@client/state/filesystem/thumbnail-load-context";
import {
  XpContextMenuProvider,
  useXpContextMenu,
} from "@client/state/context-menu/context-menu-context";
import type { GuestApplicationProps } from "@client/types/guest/guest";
import { downloadFile } from "@client/utils/download-file";

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

export function GuestDesktopApplication(props: GuestApplicationProps) {
  return (
    <XpContextMenuProvider>
      <ThumbnailLoadProvider>
        {props.session.enabled ? (
          <GuestDesktopContent {...props} />
        ) : (
          <GuestDesktopDisabled {...props} />
        )}
      </ThumbnailLoadProvider>
    </XpContextMenuProvider>
  );
}

function GuestDesktopDisabled({ session }: GuestApplicationProps) {
  return (
    <main className="desktop-state" style={DESKTOP_BACKGROUND_STYLE}>
      <XpWindowFrame
        className="state-window"
        title={GUEST_COPY.DISABLED_TITLE}
        iconPath={DESKTOP_ASSET_PATHS.START_LOGO}
        bodyClassName="state-window__body"
      >
        <p>{GUEST_COPY.DISABLED_DESCRIPTION}</p>
        <a href={session.loginUrl}>{GUEST_COPY.LOGIN}</a>
      </XpWindowFrame>
    </main>
  );
}

function GuestDesktopContent({ session, gateway }: GuestApplicationProps) {
  const workAreaRef = useRef<HTMLElement>(null);
  const desktop = useDesktopDimensions(workAreaRef);
  const entries = useDesktopEntries(gateway, 0);
  const explorer = useExplorerWindows();
  const system = useSystemWindows();
  const media = useMediaWindows();
  const programs = useGuestProgramWindows(gateway);
  const contextMenu = useXpContextMenu();
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedOverflowCount, setDismissedOverflowCount] = useState<number | null>(null);
  const iconLayout = desktopIconLayout(
    desktop,
    GUEST_DESKTOP_LAYOUT.FIXED_SHORTCUT_COUNT,
  );
  const visibleEntries = entries.entries.slice(0, iconLayout.dynamicCapacity);
  const overflowCount = Math.max(0, entries.entries.length - visibleEntries.length);
  const windowManager = useDesktopWindowManager({
    activeWidgetId: null,
    widgets: programs.windows,
    explorer,
    system,
    media,
    onActivateWidget: programs.restore,
    onFocusWidget: () => undefined,
    onMinimizeWidget: programs.minimize,
    onToggleMaximizeWidget: programs.toggleMaximize,
  });

  const openDirectory = useCallback(
    (directoryId: string, title: string, iconPath: string): void => {
      const id = explorer.open({ directoryId, title, iconPath }, desktop);
      windowManager.focus(id);
    },
    [desktop, explorer, windowManager],
  );
  const openEntry = useCallback(
    async (entry: FilesystemEntry, directoryId: string): Promise<void> => {
      try {
        setError(null);
        if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
          openDirectory(entry.id, entry.name, DESKTOP_ASSET_PATHS.FOLDER_ICON);
          return;
        }
        if (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET) {
          const id = await programs.open(entry, desktop);
          windowManager.focus(id);
          return;
        }
        const kind = mediaKindFromContentType(entry.contentType);
        if (!kind) {
          downloadFile(gateway.downloadUrl(entry.id));
          return;
        }
        const id = media.open({ entry, directoryId, kind }, desktop);
        windowManager.focus(id);
      } catch {
        setError(GUEST_COPY.PROGRAM_LOAD_FAILED);
      }
    },
    [desktop, gateway, media, openDirectory, programs, windowManager],
  );
  const closeWindow = (id: string): void => {
    if (explorer.windows.some((window) => window.id === id)) explorer.close(id);
    else if (media.windows.some((window) => window.id === id)) media.close(id);
    else if (programs.windows.some((window) => window.id === id)) programs.close(id);
    windowManager.clearActive(id);
  };
  useEffect(() => setDismissedOverflowCount(null), [overflowCount]);
  const openEntryMenu = (
    entry: FilesystemEntry,
    event: MouseEvent<HTMLButtonElement>,
  ): void => {
    contextMenu.openFromEvent(event, [
      contextMenuCommand(XP_CONTEXT_MENU_COMMAND_ID.OPEN, GUEST_COPY.OPEN, () =>
        void openEntry(entry, FILESYSTEM_ROOT_ID.DESKTOP),
      ),
      contextMenuCommand(
        XP_CONTEXT_MENU_COMMAND_ID.DOWNLOAD,
        GUEST_COPY.DOWNLOAD,
        () => downloadFile(gateway.downloadUrl(entry.id)),
        entry.kind !== FILESYSTEM_ENTRY_KIND.FILE,
      ),
    ]);
  };

  const desktopStyle = {
    ...DESKTOP_BACKGROUND_STYLE,
    "--desktop-shortcut-row-count": iconLayout.rowCount,
  } as CSSProperties;

  return (
    <div className="desktop-shell" style={desktopStyle}>
      <main
        ref={workAreaRef}
        className="desktop-work-area"
        aria-label={GUEST_COPY.PUBLIC_SPACE}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            setStartMenuOpen(false);
            contextMenu.close();
          }
        }}
      >
        <GuestDesktopShortcuts
          entries={visibleEntries}
          thumbnailUrl={gateway.thumbnailUrl.bind(gateway)}
          onOpenDocuments={() =>
            openDirectory(
              FILESYSTEM_ROOT_ID.DOCUMENTS,
              FILESYSTEM_ROOT_NAME.DOCUMENTS,
              DESKTOP_ASSET_PATHS.DOCUMENTS_ICON,
            )
          }
          onOpenEntry={(entry) =>
            void openEntry(entry, FILESYSTEM_ROOT_ID.DESKTOP)
          }
          onContextMenuEntry={openEntryMenu}
        />
        {explorer.windows.map((window) => (
          <GuestExplorerWindow
            key={window.id}
            window={window}
            desktop={desktop}
            gateway={gateway}
            isActive={windowManager.activeWindowId === window.id}
            zIndex={windowManager.zOrders[window.id] ?? DESKTOP_LAYOUT.BASE_WINDOW_Z_INDEX}
            onFocus={() => windowManager.focus(window.id)}
            onMinimize={() => windowManager.minimize(window.id)}
            onToggleMaximize={() => windowManager.toggleMaximize(window.id)}
            onClose={() => closeWindow(window.id)}
            onCommitBounds={(bounds) => explorer.commitBounds(window.id, bounds)}
            onDirectoryChanged={(directoryId, title) =>
              explorer.changeDirectory(window.id, directoryId, title)
            }
            onOpenEntry={(entry, directoryId) =>
              void openEntry(entry, directoryId)
            }
          />
        ))}
        {media.windows.map((window) => (
          <MediaViewerWindow
            key={window.id}
            window={window}
            desktop={desktop}
            gateway={gateway}
            filesystemRevision={0}
            isActive={windowManager.activeWindowId === window.id}
            zIndex={windowManager.zOrders[window.id] ?? DESKTOP_LAYOUT.BASE_WINDOW_Z_INDEX}
            onFocus={() => windowManager.focus(window.id)}
            onMinimize={() => windowManager.minimize(window.id)}
            onToggleMaximize={() => windowManager.toggleMaximize(window.id)}
            onClose={() => closeWindow(window.id)}
            onCommitBounds={(bounds) => media.commitBounds(window.id, bounds)}
            onChangeFile={(file) => media.changeFile(window.id, file)}
          />
        ))}
        {programs.windows.map((widget) => (
          <GuestProgramWindow
            key={widget.id}
            widget={widget}
            desktop={desktop}
            isActive={windowManager.activeWindowId === widget.id}
            zIndex={windowManager.zOrders[widget.id] ?? DESKTOP_LAYOUT.BASE_WINDOW_Z_INDEX}
            onFocus={() => windowManager.focus(widget.id)}
            onMinimize={() => windowManager.minimize(widget.id)}
            onToggleMaximize={() => windowManager.toggleMaximize(widget.id)}
            onClose={() => closeWindow(widget.id)}
            onCommitBounds={(bounds) => programs.commitBounds(widget.id, bounds)}
          />
        ))}
      </main>
      {error ?? entries.error ? (
        <DesktopNotification
          title={GUEST_COPY.PUBLIC_SPACE}
          message={error ?? entries.error ?? GUEST_COPY.LOAD_FAILED}
          actionLabel={GUEST_COPY.CLOSE}
          onAction={() => setError(null)}
        />
      ) : overflowCount > 0 && dismissedOverflowCount !== overflowCount ? (
        <DesktopNotification
          title={GUEST_COPY.PUBLIC_SPACE}
          message={FILESYSTEM_COPY.DESKTOP_OVERFLOW(overflowCount)}
          actionLabel={FILESYSTEM_COPY.OPEN_DESKTOP}
          onAction={() => {
            setDismissedOverflowCount(overflowCount);
            openDirectory(
              FILESYSTEM_ROOT_ID.DESKTOP,
              FILESYSTEM_ROOT_NAME.DESKTOP,
              DESKTOP_ASSET_PATHS.FOLDER_ICON,
            );
          }}
        />
      ) : null}
      <GuestStartMenu
        open={startMenuOpen}
        loginUrl={session.loginUrl}
        repositoryUrl={PROJECT_EXTERNAL_LINKS.GITHUB_REPOSITORY}
        onClose={() => setStartMenuOpen(false)}
      />
      <Taskbar
        windows={windowManager.taskbarWindows}
        isStartMenuOpen={startMenuOpen}
        saveStatus={LAYOUT_SAVE_STATUS.IDLE}
        showSaveStatus={false}
        onToggleStartMenu={() => setStartMenuOpen((current) => !current)}
        onActivateWindow={windowManager.activate}
        onRestoreWindow={windowManager.restore}
        onMinimizeWindow={windowManager.minimize}
        onToggleMaximizeWindow={windowManager.toggleMaximize}
        onCloseWindow={closeWindow}
      />
    </div>
  );
}
