import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  FILESYSTEM_SELECTION_DATA_ATTRIBUTE,
  FILESYSTEM_SELECTION_POLICY,
  FILESYSTEM_SELECTION_SELECTOR,
} from "@client/constants/filesystem/filesystem";

export interface FilesystemMarqueeBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface MarqueeOrigin {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly initialIds: ReadonlySet<string>;
}

export function useFilesystemMarqueeSelection(
  containerRef: RefObject<HTMLElement | null>,
  selectedIds: ReadonlySet<string>,
  onSelectionChange: (ids: readonly string[]) => void,
) {
  const origin = useRef<MarqueeOrigin | null>(null);
  const [bounds, setBounds] = useState<FilesystemMarqueeBounds | null>(null);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (
        event.button !== 0 ||
        event.target !== event.currentTarget ||
        !containerRef.current
      ) {
        return;
      }
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      if (
        !isPointerInsideClientArea(
          container,
          rect,
          event.clientX,
          event.clientY,
        )
      ) {
        return;
      }
      const additive = event.ctrlKey || event.metaKey;
      const x = event.clientX - rect.left + container.scrollLeft;
      const y = event.clientY - rect.top + container.scrollTop;
      origin.current = {
        pointerId: event.pointerId,
        x,
        y,
        initialIds: additive ? new Set(selectedIds) : new Set(),
      };
      if (typeof event.currentTarget.setPointerCapture === "function") {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      setBounds({ left: x, top: y, width: 0, height: 0 });
      if (!additive) onSelectionChange([]);
    },
    [containerRef, onSelectionChange, selectedIds],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const start = origin.current;
      const container = containerRef.current;
      if (!start || !container || start.pointerId !== event.pointerId) return;
      autoScroll(container, event.clientY);
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left + container.scrollLeft;
      const y = event.clientY - rect.top + container.scrollTop;
      const nextBounds = rectangleBetween(start.x, start.y, x, y);
      setBounds(nextBounds);

      const nextIds = new Set(start.initialIds);
      for (const item of container.querySelectorAll<HTMLElement>(
        FILESYSTEM_SELECTION_SELECTOR,
      )) {
        const id = item.getAttribute(FILESYSTEM_SELECTION_DATA_ATTRIBUTE);
        if (!id) continue;
        const itemRect = item.getBoundingClientRect();
        const itemBounds = {
          left: itemRect.left - rect.left + container.scrollLeft,
          top: itemRect.top - rect.top + container.scrollTop,
          width: itemRect.width,
          height: itemRect.height,
        };
        if (intersects(nextBounds, itemBounds)) nextIds.add(id);
      }
      onSelectionChange([...nextIds]);
    },
    [containerRef, onSelectionChange],
  );

  const finish = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (origin.current?.pointerId !== event.pointerId) return;
      if (
        typeof event.currentTarget.hasPointerCapture === "function" &&
        event.currentTarget.hasPointerCapture(event.pointerId) &&
        typeof event.currentTarget.releasePointerCapture === "function"
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      origin.current = null;
      setBounds(null);
    },
    [],
  );

  return {
    bounds,
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
  };
}

function rectangleBetween(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): FilesystemMarqueeBounds {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

function isPointerInsideClientArea(
  container: HTMLElement,
  rect: DOMRect,
  pointerX: number,
  pointerY: number,
): boolean {
  const clientLeft = rect.left + container.clientLeft;
  const clientTop = rect.top + container.clientTop;
  return (
    pointerX >= clientLeft &&
    pointerX < clientLeft + container.clientWidth &&
    pointerY >= clientTop &&
    pointerY < clientTop + container.clientHeight
  );
}

function intersects(
  left: FilesystemMarqueeBounds,
  right: FilesystemMarqueeBounds,
): boolean {
  return (
    left.left <= right.left + right.width &&
    left.left + left.width >= right.left &&
    left.top <= right.top + right.height &&
    left.top + left.height >= right.top
  );
}

function autoScroll(container: HTMLElement, pointerY: number): void {
  const rect = container.getBoundingClientRect();
  if (pointerY < rect.top + FILESYSTEM_SELECTION_POLICY.AUTO_SCROLL_EDGE_PX) {
    container.scrollBy(0, -FILESYSTEM_SELECTION_POLICY.AUTO_SCROLL_STEP_PX);
  } else if (
    pointerY >
    rect.bottom - FILESYSTEM_SELECTION_POLICY.AUTO_SCROLL_EDGE_PX
  ) {
    container.scrollBy(0, FILESYSTEM_SELECTION_POLICY.AUTO_SCROLL_STEP_PX);
  }
}
