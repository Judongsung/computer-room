import { useEffect, useState, type DragEvent } from "react";
import { Rnd } from "react-rnd";
import { WINDOW_STATE } from "@/constants/widgets/widget";
import { DESKTOP_WINDOW_CLASS_NAME } from "@client/constants/desktop/desktop";
import {
  XP_WINDOW_INTERACTION_CLASS_NAME,
  XP_WINDOW_INTERACTION_SELECTOR,
} from "@client/constants/shared/xp";
import { clampWindowBounds } from "@client/domain/desktop/window-layout";
import { filesystemDropEffect } from "@client/domain/filesystem/drag";
import {
  FILESYSTEM_DRAG_EVENT,
  FILESYSTEM_DROP_ATTRIBUTE,
  FILESYSTEM_DROP_EFFECT,
} from "@client/constants/filesystem/drag";
import type { MovableDesktopWindowProps } from "@client/types/desktop/desktop";
import type { WindowBounds } from "@client/types/desktop/window";

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
    setDraftBounds(clampWindowBounds(
      { x: position.x, y: position.y },
      { width: size.width, height: size.height },
      { width: desktop.width, height: desktop.height },
    ));
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
      {...{ [FILESYSTEM_DROP_ATTRIBUTE.BOUNDARY]: true }}
      onDragEnter={containFileDrag}
      onDragOver={containFileDrag}
      onDragLeave={containFileDrag}
      onDrop={containFileDrag}
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

function containFileDrag(event: DragEvent): void {
  if (filesystemDropEffect(event.dataTransfer) === FILESYSTEM_DROP_EFFECT.NONE) return;
  event.stopPropagation();
  if (event.type === FILESYSTEM_DRAG_EVENT.DROP) event.preventDefault();
}
