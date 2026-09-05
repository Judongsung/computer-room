import { useCallback, useEffect, useState, type DragEvent } from "react";
import {
  FILESYSTEM_DRAG_EVENT,
  FILESYSTEM_DROP_ATTRIBUTE,
  FILESYSTEM_DROP_EFFECT,
  FILESYSTEM_DROP_OWNER_SELECTOR,
} from "@client/constants/filesystem/drag";
import { filesystemDropEffect } from "@client/domain/filesystem/drag";
import type {
  FilesystemDropOptions,
  FilesystemDropTargetProps,
  FilesystemDropTargets,
} from "@client/types/filesystem/drag";

export function useFilesystemDropTarget(): FilesystemDropTargets {
  const [targetId, setTargetId] = useState<string | null>(null);
  const reset = useCallback(() => setTargetId(null), []);

  useEffect(() => {
    document.addEventListener(FILESYSTEM_DRAG_EVENT.DROP, reset, true);
    document.addEventListener(FILESYSTEM_DRAG_EVENT.END, reset, true);
    return () => {
      document.removeEventListener(FILESYSTEM_DRAG_EVENT.DROP, reset, true);
      document.removeEventListener(FILESYSTEM_DRAG_EVENT.END, reset, true);
    };
  }, [reset]);

  function getProps<T extends HTMLElement>(
    id: string,
    onDrop: (event: DragEvent<T>) => void,
    { disabled = false, allowLocalFiles = true }: FilesystemDropOptions = {},
  ): FilesystemDropTargetProps<T> {
    const clear = () => setTargetId((current) => current === id ? null : current);
    const effectFor = (event: DragEvent<T>) => disabled
      ? FILESYSTEM_DROP_EFFECT.NONE
      : filesystemDropEffect(event.dataTransfer, allowLocalFiles);
    const onDragOver = (event: DragEvent<T>) => {
      if (dropOwner(event.target) !== event.currentTarget) return;
      // Inspect types only: browsers protect the payload until the drop event.
      if (filesystemDropEffect(event.dataTransfer) === FILESYSTEM_DROP_EFFECT.NONE) return;
      event.stopPropagation();
      event.dataTransfer.dropEffect = effectFor(event);
      if (event.dataTransfer.dropEffect === FILESYSTEM_DROP_EFFECT.NONE) {
        clear();
        return;
      }
      event.preventDefault();
      setTargetId(id);
    };

    return {
      [FILESYSTEM_DROP_ATTRIBUTE.TARGET]: id,
      "data-drop-target": !disabled && targetId === id,
      onDragEnter: onDragOver,
      onDragOver,
      onDragLeave: (event) => {
        if (dropOwner(event.relatedTarget) !== event.currentTarget) clear();
      },
      onDrop: (event) => {
        if (dropOwner(event.target) !== event.currentTarget) return;
        if (filesystemDropEffect(event.dataTransfer) === FILESYSTEM_DROP_EFFECT.NONE) return;
        event.preventDefault();
        event.stopPropagation();
        reset();
        if (effectFor(event) !== FILESYSTEM_DROP_EFFECT.NONE) onDrop(event);
      },
    };
  }

  return { reset, getProps };
}

function dropOwner(target: EventTarget | null): Element | null {
  const element = target instanceof Element
    ? target
    : target instanceof Node ? target.parentElement : null;
  return element?.closest(FILESYSTEM_DROP_OWNER_SELECTOR) ?? null;
}
