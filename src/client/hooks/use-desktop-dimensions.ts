import { useLayoutEffect, useState, type RefObject } from "react";
import { DESKTOP_FALLBACK_WORK_AREA } from "../constants/desktop";
import type { DesktopDimensions } from "../types/desktop";

const FALLBACK_DIMENSIONS: DesktopDimensions = {
  width: DESKTOP_FALLBACK_WORK_AREA.WIDTH_PX,
  height: DESKTOP_FALLBACK_WORK_AREA.HEIGHT_PX,
};

export function useDesktopDimensions(
  ref: RefObject<HTMLElement | null>,
): DesktopDimensions {
  const [dimensions, setDimensions] = useState(FALLBACK_DIMENSIONS);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }

    const update = (): void => {
      setDimensions({
        width: element.clientWidth || FALLBACK_DIMENSIONS.width,
        height: element.clientHeight || FALLBACK_DIMENSIONS.height,
      });
    };
    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return dimensions;
}
