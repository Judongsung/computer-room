import { lazy } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LazyFeatureBoundary } from "@client/components/shared/lazy-feature-boundary";
import { LAZY_FEATURE_LABEL } from "@client/constants/shared/lazy-feature";

describe("LazyFeatureBoundary", () => {
  it("keeps an XP loading frame visible while a feature chunk is pending", () => {
    const PendingFeature = lazy(
      () => new Promise<{ default: () => null }>(() => undefined),
    );

    render(
      <LazyFeatureBoundary title="내 문서">
        <PendingFeature />
      </LazyFeatureBoundary>,
    );

    expect(screen.getByText("내 문서")).toBeInTheDocument();
    expect(screen.getByText(LAZY_FEATURE_LABEL.LOADING)).toBeInTheDocument();
  });

  it("offers a page reload after a feature chunk fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const FailedFeature = lazy(() => Promise.reject(new Error("chunk failed")));

    render(
      <LazyFeatureBoundary title="휴지통">
        <FailedFeature />
      </LazyFeatureBoundary>,
    );

    expect(await screen.findByText(LAZY_FEATURE_LABEL.LOAD_FAILED)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: LAZY_FEATURE_LABEL.RELOAD }),
    ).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
