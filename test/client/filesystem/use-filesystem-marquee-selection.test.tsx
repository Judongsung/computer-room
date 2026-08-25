import { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  FILESYSTEM_SELECTION_DATA_ATTRIBUTE,
  FILESYSTEM_SELECTION_POLICY,
} from "@client/constants/filesystem/filesystem";
import { FilesystemSelectionMarquee } from "@client/components/filesystem/filesystem-selection-marquee";
import { useFilesystemMarqueeSelection } from "@client/hooks/filesystem/use-filesystem-marquee-selection";

describe("filesystem marquee selection", () => {
  it("selects intersecting items and scrolls near the lower edge", () => {
    render(<MarqueeHarness />);
    const container = screen.getByTestId("selection-area");
    const first = screen.getByTestId("entry-a");
    const second = screen.getByTestId("entry-b");
    const scrollBy = vi.fn();
    Object.defineProperty(container, "scrollBy", { value: scrollBy });
    configureScrollableContainer(container);
    Object.defineProperty(first, "getBoundingClientRect", {
      value: () => rectangle(10, 10, 20, 20),
    });
    Object.defineProperty(second, "getBoundingClientRect", {
      value: () => rectangle(120, 120, 20, 20),
    });

    fireEvent.pointerDown(container, {
      button: 0,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(container, {
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });
    expect(screen.getByTestId("selected-ids")).toHaveTextContent("a");
    expect(
      container.querySelector(".filesystem-selection-marquee"),
    ).toBeInTheDocument();

    fireEvent.pointerMove(container, {
      pointerId: 1,
      clientX: 50,
      clientY: 195,
    });
    expect(scrollBy).toHaveBeenCalledWith(
      0,
      FILESYSTEM_SELECTION_POLICY.AUTO_SCROLL_STEP_PX,
    );
    fireEvent.pointerUp(container, { pointerId: 1 });
    expect(
      container.querySelector(".filesystem-selection-marquee"),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["vertical", { clientX: 190, clientY: 50 }],
    ["horizontal", { clientX: 50, clientY: 190 }],
  ])(
    "ignores pointer input in the %s scrollbar gutter",
    (_direction, coordinates) => {
      render(<MarqueeHarness initialSelected={["a"]} />);
      const container = screen.getByTestId("selection-area");
      const setPointerCapture = vi.fn();
      const scrollBy = vi.fn();
      configureScrollableContainer(container);
      Object.defineProperties(container, {
        setPointerCapture: { value: setPointerCapture },
        scrollBy: { value: scrollBy },
      });

      fireEvent.pointerDown(container, {
        button: 0,
        pointerId: 1,
        ...coordinates,
      });
      fireEvent.pointerMove(container, {
        pointerId: 1,
        clientX: coordinates.clientX,
        clientY: 195,
      });

      expect(screen.getByTestId("selected-ids")).toHaveTextContent("a");
      expect(
        container.querySelector(".filesystem-selection-marquee"),
      ).not.toBeInTheDocument();
      expect(setPointerCapture).not.toHaveBeenCalled();
      expect(scrollBy).not.toHaveBeenCalled();
    },
  );
});

function MarqueeHarness({
  initialSelected = [],
}: {
  readonly initialSelected?: readonly string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] =
    useState<readonly string[]>(initialSelected);
  const marquee = useFilesystemMarqueeSelection(
    ref,
    new Set(selected),
    setSelected,
  );
  return (
    <div
      ref={ref}
      data-testid="selection-area"
      onPointerDown={marquee.onPointerDown}
      onPointerMove={marquee.onPointerMove}
      onPointerUp={marquee.onPointerUp}
      onPointerCancel={marquee.onPointerCancel}
    >
      <button
        type="button"
        data-testid="entry-a"
        {...{ [FILESYSTEM_SELECTION_DATA_ATTRIBUTE]: "a" }}
      />
      <button
        type="button"
        data-testid="entry-b"
        {...{ [FILESYSTEM_SELECTION_DATA_ATTRIBUTE]: "b" }}
      />
      <output data-testid="selected-ids">{selected.join(",")}</output>
      <FilesystemSelectionMarquee bounds={marquee.bounds} />
    </div>
  );
}

function configureScrollableContainer(container: HTMLElement): void {
  Object.defineProperties(container, {
    clientWidth: { value: 184 },
    clientHeight: { value: 184 },
    getBoundingClientRect: {
      value: () => rectangle(0, 0, 200, 200),
    },
  });
}

function rectangle(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}
