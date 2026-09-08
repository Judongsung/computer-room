import type { WindowPosition, WindowRestoreState, WindowSize, WindowState } from "@/types/widgets/widget";

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
