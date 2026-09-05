import { lazy } from "react";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { DashboardWidget, WidgetType } from "@/types/widgets/widget";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { ImageUploadProfileGateway } from "@client/types/integrations/image-upload-profile";
import type { ImageUploadLogGateway } from "@client/types/integrations/image-upload-log";
import type { GuestAccessGateway } from "@client/types/admin/guest-access";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { DesktopDimensions, WindowBounds } from "@client/types/desktop/desktop";
import type { LocalUploadNode } from "@client/types/filesystem/upload";
import type { useExplorerWindows } from "@client/hooks/desktop/use-explorer-windows";
import type { useSystemWindows } from "@client/hooks/desktop/use-system-windows";
import type { useMediaWindows } from "@client/hooks/media/use-media-windows";
import {
  SYSTEM_APP_CONFIG,
  SYSTEM_APP_ID,
} from "@client/constants/desktop/system-app";
import { SYSTEM_APP_TITLE_BY_ID } from "@client/content/ko/desktop/system-app";
import { DESKTOP_LAYOUT } from "@client/constants/desktop/desktop";
import { DesktopWindow } from "@client/components/desktop/desktop-window";
import { LazyFeatureBoundary } from "@client/components/shared/lazy-feature-boundary";

const DocumentsWindow = lazy(() =>
  import("@client/components/filesystem/explorer/documents-window").then((module) => ({
    default: module.DocumentsWindow,
  })),
);
const MyComputerWindow = lazy(() =>
  import("@client/components/filesystem/my-computer-window").then((module) => ({
    default: module.MyComputerWindow,
  })),
);
const RecycleBinWindow = lazy(() =>
  import("@client/components/filesystem/recycle/recycle-bin-window").then((module) => ({
    default: module.RecycleBinWindow,
  })),
);
const MediaViewerWindow = lazy(() =>
  import("@client/components/media/media-viewer-window").then((module) => ({
    default: module.MediaViewerWindow,
  })),
);

interface DesktopWindowLayerProps {
  readonly desktop: DesktopDimensions;
  readonly widgets: readonly DashboardWidget[];
  readonly activeWindowId: string | null;
  readonly zOrders: Readonly<Record<string, number>>;
  readonly gateway: DashboardGateway;
  readonly filesystemGateway: FilesystemGateway;
  readonly storageStatusGateway: StorageStatusGateway;
  readonly imageUploadProfileGateway: ImageUploadProfileGateway;
  readonly imageUploadLogGateway: ImageUploadLogGateway;
  readonly guestAccessGateway: GuestAccessGateway;
  readonly explorer: ReturnType<typeof useExplorerWindows>;
  readonly system: ReturnType<typeof useSystemWindows>;
  readonly media: ReturnType<typeof useMediaWindows>;
  readonly desktopCapacity: number;
  readonly filesystemRevision: number;
  readonly onFilesystemChanged: () => void;
  readonly onOpenFilesystemEntry: (entry: FilesystemEntry) => void;
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
  readonly onLaunchApplication: (type: WidgetType) => void;
}

export function DesktopWindowLayer({
  desktop,
  widgets,
  activeWindowId,
  zOrders,
  gateway,
  filesystemGateway,
  storageStatusGateway,
  imageUploadProfileGateway,
  imageUploadLogGateway,
  guestAccessGateway,
  explorer,
  system,
  media,
  desktopCapacity,
  filesystemRevision,
  onFilesystemChanged,
  onOpenFilesystemEntry,
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
  onLaunchApplication,
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
          imageUploadProfileGateway={imageUploadProfileGateway}
          imageUploadLogGateway={imageUploadLogGateway}
          guestAccessGateway={guestAccessGateway}
          onOpenFilesystemEntry={onOpenFilesystemEntry}
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
        <LazyFeatureBoundary key={window.id} title={window.title}>
          <DocumentsWindow
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
          onOpenFile={onOpenFilesystemEntry}
          initialDirectoryId={window.directoryId}
          onDirectoryChanged={explorer.changeDirectory}
          onOpenWidget={onOpenWidget}
          onEntryChanged={onEntryChanged}
          onWidgetsClosed={onWidgetsClosed}
          onUploadNodes={onUploadNodes}
          />
        </LazyFeatureBoundary>
      ))}
      {system.windows[SYSTEM_APP_ID.MY_COMPUTER].isOpen ? (
        <LazyFeatureBoundary title={SYSTEM_APP_TITLE_BY_ID[SYSTEM_APP_ID.MY_COMPUTER]}>
          <MyComputerWindow
            {...systemChrome(SYSTEM_APP_ID.MY_COMPUTER)}
            onLaunchApplication={onLaunchApplication}
          />
        </LazyFeatureBoundary>
      ) : null}
      {system.windows[SYSTEM_APP_ID.RECYCLE_BIN].isOpen ? (
        <LazyFeatureBoundary title={SYSTEM_APP_TITLE_BY_ID[SYSTEM_APP_ID.RECYCLE_BIN]}>
          <RecycleBinWindow
            {...systemChrome(SYSTEM_APP_ID.RECYCLE_BIN)}
            gateway={filesystemGateway}
            desktopCapacity={desktopCapacity}
            filesystemRevision={filesystemRevision}
            onFilesystemChanged={onFilesystemChanged}
            onWidgetsClosed={onWidgetsClosed}
          />
        </LazyFeatureBoundary>
      ) : null}
      {media.windows.map((window) => (
        <LazyFeatureBoundary key={window.id} title={window.currentFile.name}>
          <MediaViewerWindow
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
        </LazyFeatureBoundary>
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
