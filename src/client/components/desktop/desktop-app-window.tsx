import { WINDOW_STATE } from "../../../constants/widget";
import { DASHBOARD_COPY } from "../../constants/content";
import { XP_WINDOW_CONTROL_ACTION } from "../../constants/xp";
import type { DesktopAppWindowProps } from "../../types/desktop";
import { XpWindowControlButton } from "../ui/xp-window-control-button";
import { MovableDesktopWindow } from "./movable-desktop-window";
import { XpWindowFrame } from "./xp-window-frame";

export function DesktopAppWindow({
  title,
  iconPath,
  window,
  desktop,
  isActive,
  zIndex,
  minWidth,
  minHeight,
  className = "system-app-window",
  toolbar,
  footer,
  bodyClassName,
  onFocus,
  onMinimize,
  onToggleMaximize,
  onClose,
  onCommitBounds,
  children,
}: DesktopAppWindowProps) {
  const isMaximized = window.windowState === WINDOW_STATE.MAXIMIZED;
  return (
    <MovableDesktopWindow
      position={window.position}
      size={window.size}
      desktop={desktop}
      windowState={window.windowState}
      minWidth={minWidth}
      minHeight={minHeight}
      zIndex={zIndex}
      onFocus={onFocus}
      onCommitBounds={onCommitBounds}
    >
      <XpWindowFrame
        className={className}
        title={title}
        iconPath={iconPath}
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
