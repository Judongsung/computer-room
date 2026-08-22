import type { ReactNode } from "react";
import { WINDOW_STATE } from "../../../constants/widget";
import { DASHBOARD_COPY } from "../../constants/content";
import { SYSTEM_APP_CONFIG } from "../../constants/system-app";
import { XP_WINDOW_CONTROL_ACTION } from "../../constants/xp";
import type { DesktopDimensions, WindowBounds } from "../../types/desktop";
import type { SystemAppId, SystemWindowState } from "../../types/system-app";
import { XpWindowControlButton } from "../ui/xp-window-control-button";
import { MovableDesktopWindow } from "./movable-desktop-window";
import { XpWindowFrame } from "./xp-window-frame";

interface SystemAppWindowProps {
  readonly appId: SystemAppId;
  readonly window: SystemWindowState;
  readonly desktop: DesktopDimensions;
  readonly isActive: boolean;
  readonly zIndex: number;
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

export function SystemAppWindow({
  appId,
  window,
  desktop,
  isActive,
  zIndex,
  toolbar,
  footer,
  bodyClassName,
  onFocus,
  onMinimize,
  onToggleMaximize,
  onClose,
  onCommitBounds,
  children,
}: SystemAppWindowProps) {
  const config = SYSTEM_APP_CONFIG[appId];
  const isMaximized = window.windowState === WINDOW_STATE.MAXIMIZED;
  return (
    <MovableDesktopWindow
      position={window.position}
      size={window.size}
      desktop={desktop}
      windowState={window.windowState}
      minWidth={config.minWidth}
      minHeight={config.minHeight}
      zIndex={zIndex}
      onFocus={onFocus}
      onCommitBounds={onCommitBounds}
    >
      <XpWindowFrame
        className="system-app-window"
        title={config.title}
        iconPath={config.iconPath}
        isActive={isActive}
        toolbar={toolbar}
        footer={footer}
        {...(bodyClassName ? { bodyClassName } : {})}
        onMouseDown={onFocus}
        onTitleBarDoubleClick={onToggleMaximize}
        controls={
          <>
            <XpWindowControlButton
              action={XP_WINDOW_CONTROL_ACTION.MINIMIZE}
              label={DASHBOARD_COPY.MINIMIZE}
              onClick={onMinimize}
            />
            <XpWindowControlButton
              action={
                isMaximized
                  ? XP_WINDOW_CONTROL_ACTION.RESTORE
                  : XP_WINDOW_CONTROL_ACTION.MAXIMIZE
              }
              label={isMaximized ? DASHBOARD_COPY.RESTORE : DASHBOARD_COPY.MAXIMIZE}
              onClick={onToggleMaximize}
            />
            <XpWindowControlButton
              action={XP_WINDOW_CONTROL_ACTION.CLOSE}
              label={DASHBOARD_COPY.CLOSE}
              onClick={onClose}
            />
          </>
        }
      >
        {children}
      </XpWindowFrame>
    </MovableDesktopWindow>
  );
}
