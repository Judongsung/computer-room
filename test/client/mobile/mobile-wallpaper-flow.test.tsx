import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOBILE_CSS_VARIABLE } from "@client/constants/mobile/launcher";
import {
  fileEntry,
  filesystemGateway,
  pictureEntry,
  renderMobile,
} from "@test/support/mobile/mobile-app-test-helpers";

describe("mobile wallpaper flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("applies the shared wallpaper only to the home and resets it to default", async () => {
    const wallpaper = pictureEntry();
    const updateWallpaper = vi.fn(async () => ({ wallpaper: null }));
    const user = userEvent.setup();
    renderMobile({
      filesystem: filesystemGateway([wallpaper]),
      mobilePreferencesApi: {
        getPreferences: vi.fn(async () => ({ wallpaper })),
        updateWallpaper,
      },
    });

    const home = await screen.findByRole("main", {
      name: MOBILE_COPY.HOME_SCREEN,
    });
    await waitFor(() =>
      expect(
        home.style.getPropertyValue(MOBILE_CSS_VARIABLE.HOME_WALLPAPER_IMAGE),
      ).toContain(`/content/${wallpaper.id}`),
    );

    await user.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
    await user.click(
      screen.getByRole("button", { name: MOBILE_COPY.WALLPAPER }),
    );
    expect(
      await screen.findByRole("heading", { name: MOBILE_COPY.WALLPAPER }),
    ).toBeInTheDocument();
    fireEvent.load(await screen.findByAltText(wallpaper.name));
    await user.click(
      screen.getByRole("button", {
        name: MOBILE_COPY.USE_DEFAULT_WALLPAPER,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: MOBILE_COPY.SET_WALLPAPER }),
    );

    await waitFor(() => expect(updateWallpaper).toHaveBeenCalledWith(null));
    const restoredHome = await screen.findByRole("main", {
      name: MOBILE_COPY.HOME_SCREEN,
    });
    expect(
      restoredHome.style.getPropertyValue(
        MOBILE_CSS_VARIABLE.HOME_WALLPAPER_IMAGE,
      ),
    ).toBe("");
  });

  it("selects an existing server image and hides non-image files", async () => {
    const wallpaper = pictureEntry();
    const textFile = fileEntry("notes", "메모.txt", "text/plain");
    const updateWallpaper = vi.fn(async () => ({ wallpaper }));
    const user = userEvent.setup();
    renderMobile({
      filesystem: filesystemGateway([wallpaper, textFile]),
      mobilePreferencesApi: {
        getPreferences: vi.fn(async () => ({ wallpaper: null })),
        updateWallpaper,
      },
    });

    await screen.findByRole("main", { name: MOBILE_COPY.HOME_SCREEN });
    await user.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
    await user.click(
      screen.getByRole("button", { name: MOBILE_COPY.WALLPAPER }),
    );
    await screen.findByRole("heading", { name: MOBILE_COPY.WALLPAPER });
    expect(
      screen.queryByRole("button", { name: textFile.name }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: wallpaper.name }));
    const preview = await screen.findByAltText(wallpaper.name);
    expect(
      screen.getByRole("button", { name: MOBILE_COPY.SET_WALLPAPER }),
    ).toBeDisabled();
    fireEvent.load(preview);
    expect(
      screen.getByRole("button", { name: MOBILE_COPY.SET_WALLPAPER }),
    ).toBeEnabled();
    await user.click(
      screen.getByRole("button", { name: MOBILE_COPY.SET_WALLPAPER }),
    );

    await waitFor(() =>
      expect(updateWallpaper).toHaveBeenCalledWith(wallpaper.id),
    );
    const home = await screen.findByRole("main", {
      name: MOBILE_COPY.HOME_SCREEN,
    });
    expect(
      home.style.getPropertyValue(MOBILE_CSS_VARIABLE.HOME_WALLPAPER_IMAGE),
    ).toContain(`/content/${wallpaper.id}`);
  });
});
