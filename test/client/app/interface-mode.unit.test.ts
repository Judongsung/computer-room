import { describe, expect, it } from "vitest";
import { CLIENT_INTERFACE_MODE } from "@client/constants/shared/interface-mode";
import { detectClientInterfaceMode } from "@client/domain/platform/interface-mode";

describe("detectClientInterfaceMode", () => {
  it("uses mobile only when the coarse-pointer phone query matches", () => {
    expect(detectClientInterfaceMode(matchMedia(true))).toBe(CLIENT_INTERFACE_MODE.MOBILE);
    expect(detectClientInterfaceMode(matchMedia(false))).toBe(CLIENT_INTERFACE_MODE.DESKTOP);
  });

  it("falls back to desktop when matchMedia is unavailable", () => {
    expect(detectClientInterfaceMode(undefined)).toBe(CLIENT_INTERFACE_MODE.DESKTOP);
  });
});

function matchMedia(matches: boolean): typeof window.matchMedia {
  return (query: string): MediaQueryList => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  });
}
