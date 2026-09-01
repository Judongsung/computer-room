import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { DESKTOP_LAYOUT } from "@client/constants/desktop/desktop";
import { XP_WINDOW_INTERACTION_SELECTOR } from "@client/constants/shared/xp";
import type {
  DesktopModalDragController,
  DesktopModalPosition,
} from "@client/types/desktop/modal";

interface ModalDragOrigin {
  readonly pointerId: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly width: number;
  readonly height: number;
}

export function useDesktopModalDrag(
  dialogRef: RefObject<HTMLDialogElement | null>,
): DesktopModalDragController {
  const [position, setPosition] = useState<DesktopModalPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const origin = useRef<ModalDragOrigin | null>(null);

  const updatePosition = useCallback((clientX: number, clientY: number): void => {
    const currentOrigin = origin.current;
    if (!currentOrigin) return;
    setPosition(
      clampModalPosition(
        clientX - currentOrigin.offsetX,
        clientY - currentOrigin.offsetY,
        currentOrigin.width,
        currentOrigin.height,
      ),
    );
  }, []);

  const finishDrag = useCallback(
    (element: HTMLDialogElement, pointerId: number): void => {
      if (origin.current?.pointerId !== pointerId) return;
      origin.current = null;
      setIsDragging(false);
      releaseCapturedPointer(element, pointerId);
    },
    [],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const clampCurrentPosition = (): void => {
      const bounds = dialog.getBoundingClientRect();
      setPosition((current) => {
        if (!current) return current;
        const next = clampModalPosition(
          current.x,
          current.y,
          bounds.width,
          bounds.height,
        );
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };

    window.addEventListener("resize", clampCurrentPosition);
    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(clampCurrentPosition)
        : null;
    resizeObserver?.observe(dialog);
    return () => {
      window.removeEventListener("resize", clampCurrentPosition);
      resizeObserver?.disconnect();
    };
  }, [dialogRef]);

  return {
    position,
    isDragging,
    onPointerDown: (event) => {
      if (
        event.button !== 0 ||
        event.isPrimary === false ||
        !isModalTitleBarTarget(event.target, event.currentTarget)
      ) {
        return;
      }

      const bounds = event.currentTarget.getBoundingClientRect();
      origin.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - bounds.left,
        offsetY: event.clientY - bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
      setPosition(
        clampModalPosition(
          bounds.left,
          bounds.top,
          bounds.width,
          bounds.height,
        ),
      );
      setIsDragging(true);
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      if (origin.current?.pointerId !== event.pointerId) return;
      updatePosition(event.clientX, event.clientY);
      event.preventDefault();
      event.stopPropagation();
    },
    onPointerUp: (event) => {
      if (origin.current?.pointerId !== event.pointerId) return;
      updatePosition(event.clientX, event.clientY);
      finishDrag(event.currentTarget, event.pointerId);
      event.stopPropagation();
    },
    onPointerCancel: (event) => {
      finishDrag(event.currentTarget, event.pointerId);
      event.stopPropagation();
    },
    onLostPointerCapture: (event) => {
      if (origin.current?.pointerId !== event.pointerId) return;
      origin.current = null;
      setIsDragging(false);
    },
  };
}

function isModalTitleBarTarget(
  target: EventTarget | null,
  dialog: HTMLDialogElement,
): boolean {
  if (!(target instanceof Element)) return false;
  const titleBar = target.closest(XP_WINDOW_INTERACTION_SELECTOR.TITLE_BAR);
  return (
    titleBar !== null &&
    dialog.contains(titleBar) &&
    target.closest(XP_WINDOW_INTERACTION_SELECTOR.CONTROLS) === null
  );
}

function clampModalPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): DesktopModalPosition {
  const margin = DESKTOP_LAYOUT.MODAL_VIEWPORT_MARGIN_PX;
  const maximumX = Math.max(margin, window.innerWidth - width - margin);
  const maximumY = Math.max(
    margin,
    window.innerHeight -
      DESKTOP_LAYOUT.TASKBAR_HEIGHT_PX -
      height -
      margin,
  );
  return {
    x: Math.min(Math.max(Math.round(x), margin), maximumX),
    y: Math.min(Math.max(Math.round(y), margin), maximumY),
  };
}

function releaseCapturedPointer(
  element: HTMLDialogElement,
  pointerId: number,
): void {
  if (
    typeof element.hasPointerCapture === "function" &&
    element.hasPointerCapture(pointerId) &&
    typeof element.releasePointerCapture === "function"
  ) {
    element.releasePointerCapture(pointerId);
  }
}
