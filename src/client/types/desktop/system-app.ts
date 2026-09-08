import type { WindowRestoreState, WindowState } from "@/types/widgets/widget";
import type { SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import type { DesktopAppWindowProps } from "@client/types/desktop/desktop";
import type { DesktopDimensions, WindowBounds } from "@client/types/desktop/window";

export type SystemAppId =
  (typeof SYSTEM_APP_ID)[keyof typeof SYSTEM_APP_ID];

export interface SystemWindowState extends WindowBounds {
  readonly id: SystemAppId;
  readonly isOpen: boolean;
  readonly windowState: WindowState;
  readonly restoreState: WindowRestoreState;
}

export type SystemWindowStateMap = Readonly<Record<SystemAppId, SystemWindowState>>;

export interface SystemWindowChromeProps {
  readonly window: SystemWindowState;
  readonly desktop: DesktopDimensions;
  readonly isActive: boolean;
  readonly zIndex: number;
  readonly onFocus: () => void;
  readonly onMinimize: () => void;
  readonly onToggleMaximize: () => void;
  readonly onClose: () => void;
  readonly onCommitBounds: (bounds: WindowBounds) => void;
}

export interface SystemAppWindowProps
  extends Omit<
    DesktopAppWindowProps,
    "title" | "iconPath" | "minWidth" | "minHeight"
  > {
  readonly appId: SystemAppId;
}
