import { useEffect, useState } from "react";
import { Rnd } from "react-rnd";
import {
  WIDGET_WINDOW_POLICY,
  WINDOW_STATE,
} from "../../../constants/widget";
import { DESKTOP_LAYOUT } from "../../constants/desktop";
import { clampWindowBounds } from "../../domain/window-layout";
import type {
  DesktopWindowProps,
  WindowBounds,
} from "../../types/desktop";
import { WidgetRenderer } from "../dashboard/widget-renderer";

const RESIZE_HANDLES = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topRight: true,
  bottomRight: true,
  bottomLeft: true,
  topLeft: true,
} as const;

export function DesktopWindow({
  widget,
  desktop,
  isActive,
  gateway,
  onFocus,
  onMinimize,
  onToggleMaximize,
  onCommitBounds,
  onWidgetChange,
}: DesktopWindowProps) {
  const normalBounds = clampWindowBounds(widget.position, widget.size, desktop);
  const [draftBounds, setDraftBounds] = useState<WindowBounds>(normalBounds);
  const isMaximized = widget.windowState === WINDOW_STATE.MAXIMIZED;
  const isMinimized = widget.windowState === WINDOW_STATE.MINIMIZED;

  useEffect(() => {
    setDraftBounds(clampWindowBounds(widget.position, widget.size, desktop));
  }, [
    desktop.height,
    desktop.width,
    widget.position.x,
    widget.position.y,
    widget.size.height,
    widget.size.width,
  ]);

  if (isMinimized) {
    return null;
  }

  const bounds = isMaximized
    ? {
        position: { x: 0, y: 0 },
        size: { width: desktop.width, height: desktop.height },
      }
    : draftBounds;
  const sizePolicy = WIDGET_WINDOW_POLICY[widget.type];

  return (
    <Rnd
      className={
        isMaximized
          ? "desktop-window desktop-window--maximized"
          : "desktop-window"
      }
      style={{
        zIndex: DESKTOP_LAYOUT.BASE_WINDOW_Z_INDEX + widget.stackOrder,
      }}
      bounds="parent"
      position={bounds.position}
      size={bounds.size}
      minWidth={sizePolicy.MIN_WIDTH}
      minHeight={sizePolicy.MIN_HEIGHT}
      maxWidth={desktop.width}
      maxHeight={desktop.height}
      disableDragging={isMaximized}
      enableResizing={isMaximized ? false : RESIZE_HANDLES}
      dragHandleClassName="widget-card__drag-handle"
      cancel=".xp-window-frame__controls"
      onMouseDown={onFocus}
      onDragStart={onFocus}
      onDrag={(_, position) => {
        setDraftBounds((current) => ({
          ...current,
          position: { x: position.x, y: position.y },
        }));
      }}
      onDragStop={(_, position) => {
        const nextBounds = clampWindowBounds(
          { x: position.x, y: position.y },
          draftBounds.size,
          desktop,
        );
        setDraftBounds(nextBounds);
        onCommitBounds(nextBounds);
      }}
      onResize={(_, __, element, ___, position) => {
        setDraftBounds({
          position: { x: position.x, y: position.y },
          size: {
            width: element.offsetWidth,
            height: element.offsetHeight,
          },
        });
      }}
      onResizeStop={(_, __, element, ___, position) => {
        const nextBounds = clampWindowBounds(
          { x: position.x, y: position.y },
          { width: element.offsetWidth, height: element.offsetHeight },
          desktop,
        );
        setDraftBounds(nextBounds);
        onCommitBounds(nextBounds);
      }}
    >
      <WidgetRenderer
        widget={widget}
        windowControls={{
          isActive,
          isMaximized,
          onFocus,
          onMinimize,
          onToggleMaximize,
        }}
        gateway={gateway}
        onWidgetChange={onWidgetChange}
      />
    </Rnd>
  );
}
