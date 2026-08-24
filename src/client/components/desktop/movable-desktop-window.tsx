import { useEffect, useState } from "react";
import { Rnd } from "react-rnd";
import { WINDOW_STATE } from "../../../constants/widget";
import { DESKTOP_WINDOW_CLASS_NAME } from "../../constants/desktop";
import {
  XP_WINDOW_INTERACTION_CLASS_NAME,
  XP_WINDOW_INTERACTION_SELECTOR,
} from "../../constants/xp";
import { clampWindowBounds } from "../../domain/window-layout";
import type {
  MovableDesktopWindowProps,
  WindowBounds,
} from "../../types/desktop";

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
  onContextMenu,
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
      className={
        isMaximized
          ? `${DESKTOP_WINDOW_CLASS_NAME.ROOT} ${DESKTOP_WINDOW_CLASS_NAME.MAXIMIZED}`
          : DESKTOP_WINDOW_CLASS_NAME.ROOT
      }
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
      dragHandleClassName={XP_WINDOW_INTERACTION_CLASS_NAME.TITLE_BAR}
      cancel={XP_WINDOW_INTERACTION_SELECTOR.CONTROLS}
      onMouseDown={onFocus}
      onContextMenu={onContextMenu}
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
