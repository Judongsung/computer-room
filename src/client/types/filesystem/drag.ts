import type { DragEvent, DragEventHandler } from "react";

export interface FilesystemDropOptions {
  readonly disabled?: boolean;
  readonly allowLocalFiles?: boolean;
}

export interface FilesystemDropTargetProps<T extends HTMLElement> {
  readonly "data-filesystem-drop-target": string;
  readonly "data-drop-target": boolean;
  readonly onDragEnter: DragEventHandler<T>;
  readonly onDragOver: DragEventHandler<T>;
  readonly onDragLeave: DragEventHandler<T>;
  readonly onDrop: DragEventHandler<T>;
}

export interface FilesystemDropTargets {
  reset(): void;
  getProps<T extends HTMLElement>(
    id: string,
    onDrop: DragEventHandler<T>,
    options?: FilesystemDropOptions,
  ): FilesystemDropTargetProps<T>;
}

export interface FilesystemDirectoryDropCapability {
  readonly targets: FilesystemDropTargets;
  readonly disabled: boolean;
  readonly onDrop: (event: DragEvent, parentId: string) => void;
}
