import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { lazy } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileLazyFeatureBoundary } from "@client/components/mobile/shared/mobile-lazy-feature-boundary";

describe("MobileLazyFeatureBoundary", () => {
  it("shows an Android activity while a feature chunk is pending", () => {
    const PendingFeature = lazy(
      () => new Promise<{ default: () => null }>(() => undefined),
    );

    render(
      <MobileLazyFeatureBoundary title={MOBILE_COPY.WALLPAPER}>
        <PendingFeature />
      </MobileLazyFeatureBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: MOBILE_COPY.WALLPAPER }),
    ).toBeInTheDocument();
    expect(screen.getByText(MOBILE_COPY.LOADING)).toBeInTheDocument();
  });

  it("offers a retry after a mobile feature chunk fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const FailedFeature = lazy(() => Promise.reject(new Error("chunk failed")));

    render(
      <MobileLazyFeatureBoundary title={MOBILE_COPY.RECYCLE_BIN}>
        <FailedFeature />
      </MobileLazyFeatureBoundary>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MOBILE_COPY.LOAD_FAILED,
    );
    expect(
      screen.getByRole("button", { name: MOBILE_COPY.RETRY }),
    ).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
