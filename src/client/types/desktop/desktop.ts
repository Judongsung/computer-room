import type {
  DashboardWidget,
  WindowPosition,
  WindowRestoreState,
  WindowSize,
  WindowState,
} from "@/types/widgets/widget";
import type { SessionInfo } from "@/types/platform/auth";
import type { MouseEvent, ReactNode } from "react";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { SaveWidgetFileInput } from "@/types/filesystem/filesystem";
import type { LayoutSaveStatus, StatusMessage } from "@client/types/widgets/dashboard";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { ImageUploadProfileGateway } from "@client/types/integrations/image-upload-profile";

export interface DesktopDimensions {
  readonly width: number;
  readonly height: number;
}

export interface WindowBounds {
  readonly position: WindowPosition;
  readonly size: WindowSize;
}

export interface WindowLifecycleState {
  readonly windowState: WindowState;
  readonly restoreState: WindowRestoreState;
}

export interface ManagedDesktopWindowState
  extends WindowBounds,
    WindowLifecycleState {}

export interface DesktopAppWindowProps {
  readonly title: string;
  readonly iconPath: string;
  readonly window: ManagedDesktopWindowState;
  readonly desktop: DesktopDimensions;
  readonly isActive: boolean;
  readonly zIndex: number;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly className?: string;
  readonly toolbar?: ReactNode;
  readonly footer?: ReactNode;
  readonly bodyClassName?: string;
  readonly onFocus: () => void;
  readonly onMinimize: () => void;
  readonly onToggleMaximize: () => void;
  readonly onClose: () => void;
  readonly onCommitBounds: (bounds: WindowBounds) => void;
  readonly children: ReactNode;
}

export interface MovableDesktopWindowProps extends WindowBounds {
  readonly desktop: DesktopDimensions;
  readonly windowState: WindowState;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly zIndex: number;
  readonly onFocus: () => void;
  readonly onCommitBounds: (bounds: WindowBounds) => void;
  readonly onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  readonly children: ReactNode;
}

export interface WidgetWindowControls {
  readonly isActive: boolean;
  readonly isMaximized: boolean;
  readonly onFocus: () => void;
  readonly onMinimize: () => void;
  readonly onToggleMaximize: () => void;
  readonly onClose: () => void;
  readonly onSaveFile: () => void;
  readonly canSaveFile: boolean;
}

export interface WidgetComponentProps {
  readonly widget: DashboardWidget;
  readonly windowControls: WidgetWindowControls;
  readonly gateway: DashboardGateway;
  readonly storageStatusGateway: StorageStatusGateway;
  readonly imageUploadProfileGateway: ImageUploadProfileGateway;
  readonly onWidgetChange: (widget: DashboardWidget) => void;
}

export interface WidgetCardProps {
  readonly title: string;
  readonly iconPath: string;
  readonly windowControls: WidgetWindowControls;
  readonly toolbarActions?: ReactNode;
  readonly children: ReactNode;
}

export interface DesktopShellProps {
  readonly session: SessionInfo;
  readonly widgets: readonly DashboardWidget[];
  readonly activeWidgetId: string | null;
  readonly gateway: DashboardGateway;
  readonly filesystemGateway: FilesystemGateway;
  readonly storageStatusGateway: StorageStatusGateway;
  readonly imageUploadProfileGateway: ImageUploadProfileGateway;
  readonly layoutSaveStatus: LayoutSaveStatus;
  readonly layoutSaveError: string | null;
  readonly message: StatusMessage | null;
  readonly onAddWidget: (
    type: DashboardWidget["type"],
    desktop: DesktopDimensions,
  ) => Promise<void>;
  readonly onOpenWidget: (widgetId: string) => Promise<void>;
  readonly onSaveWidgetFile: (
    widgetId: string,
    input: SaveWidgetFileInput,
  ) => Promise<void>;
  readonly onCloseWidget: (widgetId: string) => Promise<void>;
  readonly onDiscardWidget: (widgetId: string) => Promise<void>;
  readonly onRemoveWidgets: (widgetIds: readonly string[]) => void;
  readonly onFocusWindow: (widgetId: string) => void;
  readonly onMinimizeWindow: (widgetId: string) => void;
  readonly onToggleMaximizeWindow: (widgetId: string) => void;
  readonly onActivateTaskbarWindow: (widgetId: string) => void;
  readonly onCommitWindowBounds: (
    widgetId: string,
    bounds: WindowBounds,
  ) => void;
  readonly onWidgetChange: (widget: DashboardWidget) => void;
  readonly onRetrySave: () => void;
  readonly onDismissMessage: () => void;
}

export interface DesktopWindowProps {
  readonly widget: DashboardWidget;
  readonly desktop: DesktopDimensions;
  readonly isActive: boolean;
  readonly zIndex: number;
  readonly gateway: DashboardGateway;
  readonly storageStatusGateway: StorageStatusGateway;
  readonly imageUploadProfileGateway: ImageUploadProfileGateway;
  readonly onFocus: () => void;
  readonly onMinimize: () => void;
  readonly onToggleMaximize: () => void;
  readonly onClose: () => void;
  readonly onSaveFile: () => void;
  readonly onCommitBounds: (bounds: WindowBounds) => void;
  readonly onWidgetChange: (widget: DashboardWidget) => void;
}

export interface StartMenuProps {
  readonly isOpen: boolean;
  readonly email: string;
  readonly logoutUrl: string;
  readonly onClose: () => void;
  readonly onAddMemo: () => void;
  readonly onAddChecklist: () => void;
  readonly onAddStorageStatus: () => void;
  readonly onAddImageUploadProfiles: () => void;
}

export interface TaskbarProps {
  readonly windows: readonly TaskbarWindowItem[];
  readonly isStartMenuOpen: boolean;
  readonly saveStatus: LayoutSaveStatus;
  readonly onToggleStartMenu: () => void;
  readonly onActivateWindow: (widgetId: string) => void;
  readonly onRestoreWindow: (windowId: string) => void;
  readonly onMinimizeWindow: (windowId: string) => void;
  readonly onToggleMaximizeWindow: (windowId: string) => void;
  readonly onCloseWindow: (windowId: string) => void;
}

export interface TaskbarWindowItem {
  readonly id: string;
  readonly title: string;
  readonly iconPath: string;
  readonly isActive: boolean;
  readonly isMinimized: boolean;
  readonly isMaximized: boolean;
}

export interface DesktopNotificationProps {
  readonly title: string;
  readonly message: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
}
