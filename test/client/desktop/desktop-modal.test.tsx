import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DesktopModal } from "@client/components/desktop/desktop-modal";
import { DASHBOARD_COPY } from "@client/content/ko/widgets/content";
import { DESKTOP_LAYOUT } from "@client/constants/desktop/desktop";

describe("DesktopModal", () => {
  it("opens a framed native modal and keeps pointer events from reaching its window", () => {
    const onParentMouseDown = vi.fn();
    const onRequestClose = vi.fn();
    render(
      <div onMouseDown={onParentMouseDown}>
        <DesktopModal
          title="Confirmation"
          iconPath="/confirmation.png"
          onRequestClose={onRequestClose}
        >
          <button type="button">Confirm</button>
        </DesktopModal>
      </div>,
    );

    const dialog = screen.getByRole("dialog", { name: "Confirmation" });
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.querySelectorAll(".xp-window-frame")).toHaveLength(1);
    expect(dialog).toContainElement(
      screen.getByRole("button", { name: DASHBOARD_COPY.CLOSE }),
    );
    expect(dialog.querySelector("img")).toHaveAttribute(
      "src",
      "/confirmation.png",
    );

    fireEvent.mouseDown(screen.getByRole("button", { name: "Confirm" }));
    expect(onParentMouseDown).not.toHaveBeenCalled();
  });

  it("moves only from the title bar and clamps the window to the work area", () => {
    const onRequestClose = vi.fn();
    render(
      <DesktopModal title="Log" onRequestClose={onRequestClose}>
        <section>History</section>
      </DesktopModal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Log" });
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      x: 300,
      y: 200,
      left: 300,
      top: 200,
      right: 700,
      bottom: 450,
      width: 400,
      height: 250,
      toJSON: () => ({}),
    });
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperties(dialog, {
      setPointerCapture: { configurable: true, value: setPointerCapture },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: {
        configurable: true,
        value: releasePointerCapture,
      },
    });

    const closeButton = screen.getByRole("button", {
      name: DASHBOARD_COPY.CLOSE,
    });
    fireEvent.pointerDown(closeButton, {
      pointerId: 1,
      button: 0,
      isPrimary: true,
      clientX: 680,
      clientY: 215,
    });
    expect(setPointerCapture).not.toHaveBeenCalled();

    const titleBar = dialog.querySelector(".xp-window-frame__title-bar");
    expect(titleBar).not.toBeNull();
    fireEvent.pointerDown(titleBar!, {
      pointerId: 2,
      button: 0,
      isPrimary: true,
      clientX: 320,
      clientY: 220,
    });
    expect(setPointerCapture).toHaveBeenCalledWith(2);
    expect(dialog).toHaveClass("desktop-modal--positioned");
    expect(dialog).toHaveClass("desktop-modal--dragging");

    fireEvent.pointerMove(dialog, {
      pointerId: 2,
      clientX: 1_000,
      clientY: 700,
    });
    expect(dialog).toHaveStyle({
      left: `${
        window.innerWidth -
        400 -
        DESKTOP_LAYOUT.MODAL_VIEWPORT_MARGIN_PX
      }px`,
      top: `${
        window.innerHeight -
        DESKTOP_LAYOUT.TASKBAR_HEIGHT_PX -
        250 -
        DESKTOP_LAYOUT.MODAL_VIEWPORT_MARGIN_PX
      }px`,
    });

    fireEvent.pointerUp(dialog, {
      pointerId: 2,
      clientX: 1_000,
      clientY: 700,
    });
    expect(dialog).not.toHaveClass("desktop-modal--dragging");
    expect(releasePointerCapture).toHaveBeenCalledWith(2);

    const originalInnerWidth = window.innerWidth;
    try {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 800,
      });
      fireEvent(window, new Event("resize"));
      expect(dialog).toHaveStyle({
        left: `${
          800 - 400 - DESKTOP_LAYOUT.MODAL_VIEWPORT_MARGIN_PX
        }px`,
      });
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }

    fireEvent.pointerDown(titleBar!, {
      pointerId: 3,
      button: 0,
      isPrimary: true,
      clientX: 320,
      clientY: 220,
    });
    fireEvent.pointerCancel(dialog, { pointerId: 3 });
    expect(dialog).not.toHaveClass("desktop-modal--dragging");
  });

  it("handles native cancellation and optional backdrop dismissal", () => {
    const onRequestClose = vi.fn();
    render(
      <DesktopModal
        title="Log"
        closeOnBackdrop
        onRequestClose={onRequestClose}
      >
        <section>History</section>
      </DesktopModal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Log" });
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 100,
      left: 100,
      top: 100,
      right: 200,
      bottom: 200,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });

    const cancelEvent = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(onRequestClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(dialog, { clientX: 20, clientY: 20 });
    expect(onRequestClose).toHaveBeenCalledTimes(2);

    fireEvent.mouseDown(dialog, { clientX: 150, clientY: 150 });
    expect(onRequestClose).toHaveBeenCalledTimes(2);
  });

  it("blocks every close route while the modal is busy", () => {
    const onRequestClose = vi.fn();
    render(
      <DesktopModal
        title="Saving"
        onRequestClose={onRequestClose}
        closeOnBackdrop
        closeDisabled
      >
        <p>Pending</p>
      </DesktopModal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Saving" });
    expect(
      screen.getByRole("button", { name: DASHBOARD_COPY.CLOSE }),
    ).toBeDisabled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.mouseDown(dialog, { clientX: 0, clientY: 0 });

    expect(onRequestClose).not.toHaveBeenCalled();
  });
});
