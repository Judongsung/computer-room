import {
  WIDGET_BEHAVIOR,
  WIDGET_WINDOW_POLICY,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import type { DesktopWindowProps } from "@client/types/desktop/desktop";
import { WidgetRenderer } from "@client/components/widgets/widget-renderer";
import { MovableDesktopWindow } from "@client/components/desktop/movable-desktop-window";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import { windowContextMenuItems } from "@client/domain/context-menu/window-context-menu";

export function DesktopWindow({
  widget,
  desktop,
  isActive,
  zIndex,
  gateway,
  storageStatusGateway,
  onFocus,
  onMinimize,
  onToggleMaximize,
  onClose,
  onSaveFile,
  onCommitBounds,
  onWidgetChange,
}: DesktopWindowProps) {
  const sizePolicy = WIDGET_WINDOW_POLICY[widget.type];
  const contextMenu = useXpContextMenu();
  const isMaximized = widget.windowState === WINDOW_STATE.MAXIMIZED;
  return (
    <MovableDesktopWindow
      position={widget.position}
      size={widget.size}
      desktop={desktop}
      windowState={widget.windowState}
      minWidth={sizePolicy.MIN_WIDTH}
      minHeight={sizePolicy.MIN_HEIGHT}
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
      <WidgetRenderer
        widget={widget}
        windowControls={{
          isActive,
          isMaximized,
          onFocus,
          onMinimize,
          onToggleMaximize,
          onClose,
          onSaveFile,
          canSaveFile:
            WIDGET_BEHAVIOR[widget.type].supportsFileStorage &&
            widget.file === null,
        }}
        gateway={gateway}
        storageStatusGateway={storageStatusGateway}
        onWidgetChange={onWidgetChange}
      />
    </MovableDesktopWindow>
  );
}
