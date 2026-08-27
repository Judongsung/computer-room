import { useRef, type PointerEventHandler } from "react";
import { MOBILE_IMAGE_SWIPE } from "@client/constants/media/mobile-media";

interface HorizontalImageSwipeOptions {
  readonly enabled: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

interface SwipeStart {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
}

export interface HorizontalImageSwipeHandlers {
  readonly onPointerDown: PointerEventHandler<HTMLElement>;
  readonly onPointerUp: PointerEventHandler<HTMLElement>;
  readonly onPointerCancel: PointerEventHandler<HTMLElement>;
  readonly onLostPointerCapture: PointerEventHandler<HTMLElement>;
}

export function useHorizontalImageSwipe({
  enabled,
  onPrevious,
  onNext,
}: HorizontalImageSwipeOptions): HorizontalImageSwipeHandlers {
  const start = useRef<SwipeStart | null>(null);

  const onPointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (!enabled || event.isPrimary === false) return;
    start.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerUp: PointerEventHandler<HTMLElement> = (event) => {
    const origin = start.current;
    if (!origin || origin.pointerId !== event.pointerId) return;

    releaseCapturedPointer(event.currentTarget, event.pointerId);
    start.current = null;
    if (!enabled) return;

    const horizontalDistance = event.clientX - origin.x;
    const verticalDistance = event.clientY - origin.y;
    const absoluteHorizontalDistance = Math.abs(horizontalDistance);
    if (
      absoluteHorizontalDistance < MOBILE_IMAGE_SWIPE.MIN_DISTANCE_PX ||
      absoluteHorizontalDistance <
        Math.abs(verticalDistance) *
          MOBILE_IMAGE_SWIPE.HORIZONTAL_DOMINANCE_RATIO
    ) {
      return;
    }
    if (horizontalDistance < 0) onNext();
    else onPrevious();
  };

  const onPointerCancel: PointerEventHandler<HTMLElement> = (event) => {
    if (start.current?.pointerId !== event.pointerId) return;
    releaseCapturedPointer(event.currentTarget, event.pointerId);
    start.current = null;
  };

  const onLostPointerCapture: PointerEventHandler<HTMLElement> = (event) => {
    if (start.current?.pointerId !== event.pointerId) return;
    start.current = null;
  };

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  };
}

function releaseCapturedPointer(target: HTMLElement, pointerId: number): void {
  if (
    typeof target.hasPointerCapture === "function" &&
    target.hasPointerCapture(pointerId) &&
    typeof target.releasePointerCapture === "function"
  ) {
    target.releasePointerCapture(pointerId);
  }
}
