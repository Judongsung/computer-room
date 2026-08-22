import { WIDGET_WINDOW_POLICY, WINDOW_STATE } from "../../../constants/widget";
import type { DesktopWindowProps } from "../../types/desktop";
import { WidgetRenderer } from "../dashboard/widget-renderer";
import { MovableDesktopWindow } from "./movable-desktop-window";

export function DesktopWindow({
  widget,
  desktop,
  isActive,
  zIndex,
  gateway,
  onFocus,
  onMinimize,
  onToggleMaximize,
  onCommitBounds,
  onWidgetChange,
}: DesktopWindowProps) {
  const sizePolicy = WIDGET_WINDOW_POLICY[widget.type];
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
    >
      <WidgetRenderer
        widget={widget}
        windowControls={{
          isActive,
          isMaximized: widget.windowState === WINDOW_STATE.MAXIMIZED,
          onFocus,
          onMinimize,
          onToggleMaximize,
        }}
        gateway={gateway}
        onWidgetChange={onWidgetChange}
      />
    </MovableDesktopWindow>
  );
}
