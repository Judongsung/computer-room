import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POINTER_TYPE } from "@client/constants/shared/pointer";
import {
  dashboardGateway,
  fileEntry,
  filesystemGateway,
  pictureEntry,
  renderMobile,
} from "@test/support/mobile/mobile-app-test-helpers";

describe("mobile shell navigation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("shows the Android home without loading PC-open widgets", async () => {
    const listWidgets = vi.fn(async () => []);
    const user = userEvent.setup();
    renderMobile({ dashboard: dashboardGateway(listWidgets) });

    expect(
      await screen.findByRole("main", { name: MOBILE_COPY.HOME_SCREEN }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: MOBILE_COPY.MY_DOCUMENTS }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: MOBILE_COPY.MY_COMPUTER }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: MOBILE_COPY.RECYCLE_BIN }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "사진" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: MOBILE_COPY.MENU })).toBeEnabled();
    expect(listWidgets).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: MOBILE_COPY.MY_DOCUMENTS }),
    );
    expect(
      await screen.findByRole("heading", { name: MOBILE_COPY.MY_DOCUMENTS }),
    ).toBeInTheDocument();
    expect(listWidgets).not.toHaveBeenCalled();
  });

  it("replaces the current image while swiping without adding history", async () => {
    const first = pictureEntry();
    const second = fileEntry("picture-file-2", "두 번째 사진", "image/webp");
    const filesystem = filesystemGateway([first, second]);
    const user = userEvent.setup();
    renderMobile({ filesystem });

    await user.click(await screen.findByRole("button", { name: first.name }));
    expect(
      await screen.findByRole("heading", { name: first.name }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(filesystem.listDirectory).toHaveBeenCalledTimes(2),
    );
    const viewport = screen.getByAltText(first.name).parentElement;
    if (!viewport) throw new Error("Expected image swipe viewport.");
    fireEvent.pointerDown(viewport, {
      pointerId: 1,
      isPrimary: true,
      clientX: 260,
      clientY: 100,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 1,
      clientX: 120,
      clientY: 100,
    });

    expect(
      await screen.findByRole("heading", { name: second.name }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: MOBILE_COPY.BACK }));
    expect(
      await screen.findByRole("main", { name: MOBILE_COPY.HOME_SCREEN }),
    ).toBeInTheDocument();
  });

  it("opens home on the first touch after an image swipe omits click", async () => {
    const first = pictureEntry();
    const second = fileEntry("picture-file-2", "두 번째 사진", "image/webp");
    const filesystem = filesystemGateway([first, second]);
    const user = userEvent.setup();
    renderMobile({ filesystem });

    await user.click(await screen.findByRole("button", { name: first.name }));
    await waitFor(() =>
      expect(filesystem.listDirectory).toHaveBeenCalledTimes(2),
    );
    const viewport = screen.getByAltText(first.name).parentElement;
    if (!viewport) throw new Error("Expected image swipe viewport.");
    fireEvent.pointerDown(viewport, {
      pointerId: 1,
      pointerType: POINTER_TYPE.TOUCH,
      isPrimary: true,
      clientX: 260,
      clientY: 100,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 1,
      pointerType: POINTER_TYPE.TOUCH,
      isPrimary: true,
      clientX: 120,
      clientY: 100,
    });
    expect(
      await screen.findByRole("heading", { name: second.name }),
    ).toBeInTheDocument();

    const home = screen.getByRole("button", { name: MOBILE_COPY.HOME });
    fireEvent.pointerDown(home, {
      pointerId: 2,
      pointerType: POINTER_TYPE.TOUCH,
      isPrimary: true,
    });
    fireEvent.pointerUp(home, {
      pointerId: 2,
      pointerType: POINTER_TYPE.TOUCH,
      isPrimary: true,
    });

    expect(
      await screen.findByRole("main", { name: MOBILE_COPY.HOME_SCREEN }),
    ).toBeInTheDocument();
  });
});
