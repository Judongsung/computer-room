import { WINDOW_STATE } from "@/constants/widgets/widget";
import { DASHBOARD_COPY } from "@client/content/ko/widgets/content";
import { XP_WINDOW_CONTROL_ACTION } from "@client/constants/shared/xp";
import type { DesktopAppWindowProps } from "@client/types/desktop/desktop";
import { XpWindowControlButton } from "@client/components/shared/xp-window-control-button";
import { MovableDesktopWindow } from "@client/components/desktop/movable-desktop-window";
import { XpWindowFrame } from "@client/components/desktop/xp-window-frame";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import { windowContextMenuItems } from "@client/domain/context-menu/window-context-menu";

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
  const contextMenu = useXpContextMenu();
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
      onContextMenu={(event) =>
        contextMenu.openFromEvent(
          event,
          windowContextMenuItems({
            isMaximized,
            onMinimize,
            onToggleMaximize,
            onClose,
          }),
        )
      }
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
