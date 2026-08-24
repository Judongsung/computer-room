import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { DashboardWidget, WidgetType } from "@/types/widgets/widget";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { DesktopDimensions, WindowBounds } from "@client/types/desktop/desktop";
import type { MediaViewerOpenRequest } from "@client/types/media/media";
import type { LocalUploadNode } from "@client/types/filesystem/upload";
import type { useExplorerWindows } from "@client/hooks/desktop/use-explorer-windows";
import type { useSystemWindows } from "@client/hooks/desktop/use-system-windows";
import type { useMediaWindows } from "@client/hooks/media/use-media-windows";
import { SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import { DESKTOP_LAYOUT } from "@client/constants/desktop/desktop";
import { DesktopWindow } from "./desktop-window";
import { DocumentsWindow } from "@client/components/filesystem/documents-window";
import { MyComputerWindow } from "@client/components/filesystem/my-computer-window";
import { RecycleBinWindow } from "@client/components/filesystem/recycle-bin-window";
import { MediaViewerWindow } from "@client/components/media/media-viewer-window";

interface DesktopWindowLayerProps {
  readonly desktop: DesktopDimensions;
  readonly widgets: readonly DashboardWidget[];
  readonly activeWindowId: string | null;
  readonly zOrders: Readonly<Record<string, number>>;
  readonly gateway: DashboardGateway;
  readonly filesystemGateway: FilesystemGateway;
  readonly storageStatusGateway: StorageStatusGateway;
  readonly explorer: ReturnType<typeof useExplorerWindows>;
  readonly system: ReturnType<typeof useSystemWindows>;
  readonly media: ReturnType<typeof useMediaWindows>;
  readonly desktopCapacity: number;
  readonly filesystemRevision: number;
  readonly onFilesystemChanged: () => void;
  readonly onOpenMedia: (request: MediaViewerOpenRequest) => void;
  readonly onOpenWidget: (widgetId: string) => void;
  readonly onEntryChanged: (entry: FilesystemEntry) => void;
  readonly onWidgetsClosed: (widgetIds: readonly string[]) => void;
  readonly onUploadNodes: (
    nodes: readonly LocalUploadNode[],
    parentId: string,
    notice?: string | null,
  ) => Promise<void>;
  readonly onFocusWindow: (id: string, persist?: () => void) => void;
  readonly onClearActive: (id?: string) => void;
  readonly onRequestWidgetClose: (id: string) => void;
  readonly onFocusWidget: (id: string) => void;
  readonly onMinimizeWidget: (id: string) => void;
  readonly onToggleMaximizeWidget: (id: string) => void;
  readonly onCommitWidgetBounds: (id: string, bounds: WindowBounds) => void;
  readonly onWidgetChange: (widget: DashboardWidget) => void;
  readonly onSaveWidgetFile: (id: string) => void;
  readonly onAddWidget: (type: WidgetType) => void;
}

export function DesktopWindowLayer({
  desktop,
  widgets,
  activeWindowId,
  zOrders,
  gateway,
  filesystemGateway,
  storageStatusGateway,
  explorer,
  system,
  media,
  desktopCapacity,
  filesystemRevision,
  onFilesystemChanged,
  onOpenMedia,
  onOpenWidget,
  onEntryChanged,
  onWidgetsClosed,
  onUploadNodes,
  onFocusWindow,
  onClearActive,
  onRequestWidgetClose,
  onFocusWidget,
  onMinimizeWidget,
  onToggleMaximizeWidget,
  onCommitWidgetBounds,
  onWidgetChange,
  onSaveWidgetFile,
  onAddWidget,
}: DesktopWindowLayerProps) {
  const systemChrome = (id: typeof SYSTEM_APP_ID.MY_COMPUTER | typeof SYSTEM_APP_ID.RECYCLE_BIN) => ({
    window: system.windows[id],
    desktop,
    isActive: activeWindowId === id,
    zIndex: desktopWindowZIndex(id, zOrders, 60),
    onFocus: () => onFocusWindow(id),
    onMinimize: () => {
      system.minimize(id);
      onClearActive(id);
    },
    onToggleMaximize: () => {
      system.toggleMaximize(id);
      onFocusWindow(id);
    },
    onClose: () => {
      system.close(id);
      onClearActive(id);
    },
    onCommitBounds: (bounds: WindowBounds) => system.commitBounds(id, bounds),
  });

  return (
    <>
      {widgets.map((widget) => (
        <DesktopWindow
          key={widget.id}
          widget={widget}
          desktop={desktop}
          isActive={widget.id === activeWindowId}
          zIndex={desktopWindowZIndex(widget.id, zOrders, widget.stackOrder)}
          gateway={gateway}
          storageStatusGateway={storageStatusGateway}
          onFocus={() => onFocusWindow(widget.id, () => onFocusWidget(widget.id))}
          onMinimize={() => {
            onMinimizeWidget(widget.id);
            onClearActive(widget.id);
          }}
          onToggleMaximize={() => {
            onToggleMaximizeWidget(widget.id);
            onFocusWindow(widget.id);
          }}
          onClose={() => onRequestWidgetClose(widget.id)}
          onSaveFile={() => onSaveWidgetFile(widget.id)}
          onCommitBounds={(bounds) => onCommitWidgetBounds(widget.id, bounds)}
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
          onFocus={() => onFocusWindow(window.id)}
          onMinimize={() => {
            explorer.minimize(window.id);
            onClearActive(window.id);
          }}
          onToggleMaximize={() => {
            explorer.toggleMaximize(window.id);
            onFocusWindow(window.id);
          }}
          onClose={() => {
            explorer.close(window.id);
            onClearActive(window.id);
          }}
          onCommitBounds={(bounds) => explorer.commitBounds(window.id, bounds)}
          gateway={filesystemGateway}
          desktopCapacity={desktopCapacity}
          filesystemRevision={filesystemRevision}
          onFilesystemChanged={onFilesystemChanged}
          onOpenMedia={onOpenMedia}
          initialDirectoryId={window.directoryId}
          onDirectoryChanged={explorer.changeDirectory}
          onOpenWidget={onOpenWidget}
          onEntryChanged={onEntryChanged}
          onWidgetsClosed={onWidgetsClosed}
          onUploadNodes={onUploadNodes}
        />
      ))}
      {system.windows[SYSTEM_APP_ID.MY_COMPUTER].isOpen ? (
        <MyComputerWindow {...systemChrome(SYSTEM_APP_ID.MY_COMPUTER)} onAddWidget={onAddWidget} />
      ) : null}
      {system.windows[SYSTEM_APP_ID.RECYCLE_BIN].isOpen ? (
        <RecycleBinWindow
          {...systemChrome(SYSTEM_APP_ID.RECYCLE_BIN)}
          gateway={filesystemGateway}
          desktopCapacity={desktopCapacity}
          filesystemRevision={filesystemRevision}
          onFilesystemChanged={onFilesystemChanged}
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
          onFocus={() => onFocusWindow(window.id)}
          onMinimize={() => {
            media.minimize(window.id);
            onClearActive(window.id);
          }}
          onToggleMaximize={() => {
            media.toggleMaximize(window.id);
            onFocusWindow(window.id);
          }}
          onClose={() => {
            media.close(window.id);
            onClearActive(window.id);
          }}
          onCommitBounds={(bounds) => media.commitBounds(window.id, bounds)}
          onChangeFile={(entry) => media.changeFile(window.id, entry)}
        />
      ))}
    </>
  );
}

function desktopWindowZIndex(
  id: string,
  zOrders: Readonly<Record<string, number>>,
  fallback: number,
): number {
  return DESKTOP_LAYOUT.BASE_WINDOW_Z_INDEX + (zOrders[id] ?? fallback);
}
