import type { PointerEventHandler, ReactNode } from "react";
import type { DESKTOP_MODAL_VARIANT } from "@client/constants/desktop/modal";

export type DesktopModalVariant =
  (typeof DESKTOP_MODAL_VARIANT)[keyof typeof DESKTOP_MODAL_VARIANT];

export interface DesktopModalProps {
  readonly title: string;
  readonly iconPath?: string;
  readonly variant?: DesktopModalVariant;
  readonly className?: string;
  readonly windowClassName?: string;
  readonly bodyClassName?: string;
  readonly footer?: ReactNode;
  readonly closeOnBackdrop?: boolean;
  readonly onRequestClose?: () => void;
  readonly closeDisabled?: boolean;
  readonly children: ReactNode;
}

export interface DesktopModalPosition {
  readonly x: number;
  readonly y: number;
}

export interface DesktopModalDragController {
  readonly position: DesktopModalPosition | null;
  readonly isDragging: boolean;
  readonly onPointerDown: PointerEventHandler<HTMLDialogElement>;
  readonly onPointerMove: PointerEventHandler<HTMLDialogElement>;
  readonly onPointerUp: PointerEventHandler<HTMLDialogElement>;
  readonly onPointerCancel: PointerEventHandler<HTMLDialogElement>;
  readonly onLostPointerCapture: PointerEventHandler<HTMLDialogElement>;
}
