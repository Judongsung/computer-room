import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileNavigationBar } from "@client/components/mobile/shared/mobile-navigation-bar";
import { MOBILE_COPY } from "@client/constants/shared/mobile";
import { POINTER_TYPE } from "@client/constants/shared/pointer";

describe("MobileNavigationBar", () => {
  it("activates from touch pointerup when Chromium omits click", () => {
    const onHome = vi.fn();
    renderNavigation({ onHome });

    fireEvent.pointerDown(homeButton(), touchPointer(1));
    fireEvent.pointerUp(homeButton(), touchPointer(1));

    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate a touch activation when click follows pointerup", () => {
    const onHome = vi.fn();
    renderNavigation({ onHome });

    fireEvent.pointerDown(homeButton(), touchPointer(2));
    fireEvent.pointerUp(homeButton(), touchPointer(2));
    fireTouchClick(homeButton(), 2);

    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("keeps mouse and keyboard click activation", () => {
    const onHome = vi.fn();
    renderNavigation({ onHome });

    fireEvent.pointerDown(homeButton(), touchPointer(3));
    fireEvent.pointerUp(homeButton(), touchPointer(3));
    fireEvent.pointerDown(homeButton(), {
      pointerId: 4,
      pointerType: "mouse",
      isPrimary: true,
    });
    fireEvent.click(homeButton());
    fireEvent.click(homeButton(), { detail: 0 });

    expect(onHome).toHaveBeenCalledTimes(3);
  });
});

function renderNavigation({ onHome }: { readonly onHome: () => void }): void {
  render(
    <MobileNavigationBar
      canGoBack
      menuEnabled
      menuOpen={false}
      onBack={vi.fn()}
      onHome={onHome}
      onMenu={vi.fn()}
    />,
  );
}

function homeButton(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: MOBILE_COPY.HOME,
  }) as HTMLButtonElement;
}

function touchPointer(pointerId: number) {
  return {
    pointerId,
    pointerType: POINTER_TYPE.TOUCH,
    isPrimary: true,
  } as const;
}

function fireTouchClick(element: Element, pointerId: number): void {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    detail: 1,
  });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: POINTER_TYPE.TOUCH },
  });
  fireEvent(element, event);
}
