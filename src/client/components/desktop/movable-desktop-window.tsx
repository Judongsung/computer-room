import { useEffect, useState, type ReactNode } from "react";
import { Rnd } from "react-rnd";
import { WINDOW_STATE } from "../../../constants/widget";
import { clampWindowBounds } from "../../domain/window-layout";
import type { DesktopDimensions, WindowBounds } from "../../types/desktop";

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

interface MovableDesktopWindowProps extends WindowBounds {
  readonly desktop: DesktopDimensions;
  readonly windowState: string;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly zIndex: number;
  readonly onFocus: () => void;
  readonly onCommitBounds: (bounds: WindowBounds) => void;
  readonly children: ReactNode;
}

export function MovableDesktopWindow({
  position,
  size,
  desktop,
  windowState,
  minWidth,
  minHeight,
  zIndex,
  onFocus,
  onCommitBounds,
  children,
}: MovableDesktopWindowProps) {
  const normalBounds = clampWindowBounds(position, size, desktop);
  const [draftBounds, setDraftBounds] = useState<WindowBounds>(normalBounds);
  const isMaximized = windowState === WINDOW_STATE.MAXIMIZED;

  useEffect(() => {
    setDraftBounds(clampWindowBounds(position, size, desktop));
  }, [desktop.height, desktop.width, position.x, position.y, size.height, size.width]);

  if (windowState === WINDOW_STATE.MINIMIZED) {
    return null;
  }
  const bounds = isMaximized
    ? {
        position: { x: 0, y: 0 },
        size: { width: desktop.width, height: desktop.height },
      }
    : draftBounds;

  return (
    <Rnd
      className={isMaximized ? "desktop-window desktop-window--maximized" : "desktop-window"}
      style={{ zIndex }}
      bounds="parent"
      position={bounds.position}
      size={bounds.size}
      minWidth={minWidth}
      minHeight={minHeight}
      maxWidth={desktop.width}
      maxHeight={desktop.height}
      disableDragging={isMaximized}
      enableResizing={isMaximized ? false : RESIZE_HANDLES}
      dragHandleClassName="xp-window-frame__title-bar"
      cancel=".xp-window-frame__controls"
      onMouseDown={onFocus}
      onDragStart={onFocus}
      onDrag={(_, nextPosition) => {
        setDraftBounds((current) => ({
          ...current,
          position: { x: nextPosition.x, y: nextPosition.y },
        }));
      }}
      onDragStop={(_, nextPosition) => {
        const nextBounds = clampWindowBounds(
          { x: nextPosition.x, y: nextPosition.y },
          draftBounds.size,
          desktop,
        );
        setDraftBounds(nextBounds);
        onCommitBounds(nextBounds);
      }}
      onResize={(_, __, element, ___, nextPosition) => {
        setDraftBounds({
          position: { x: nextPosition.x, y: nextPosition.y },
          size: { width: element.offsetWidth, height: element.offsetHeight },
        });
      }}
      onResizeStop={(_, __, element, ___, nextPosition) => {
        const nextBounds = clampWindowBounds(
          { x: nextPosition.x, y: nextPosition.y },
          { width: element.offsetWidth, height: element.offsetHeight },
          desktop,
        );
        setDraftBounds(nextBounds);
        onCommitBounds(nextBounds);
      }}
    >
      {children}
    </Rnd>
  );
}

