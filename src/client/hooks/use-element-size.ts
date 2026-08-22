import { useEffect, useState, type RefObject } from "react";
import { EMPTY_ELEMENT_SIZE } from "../constants/media";

export function useElementSize(
  reference: RefObject<HTMLElement | null>,
): { readonly width: number; readonly height: number } {
  const [size, setSize] = useState<{ width: number; height: number }>(
    EMPTY_ELEMENT_SIZE,
  );

  useEffect(() => {
    const element = reference.current;
    if (!element) return;
    const update = (): void => {
      const bounds = element.getBoundingClientRect();
      const next = { width: bounds.width, height: bounds.height };
      setSize((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next,
      );
    };
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [reference]);

  return size;
}
