import { describe, expect, it } from "vitest";
import { API_ROUTE_PATTERN } from "@/constants/platform/http-route";
import {
  createExactApiRoutePattern,
  matchesApiPathNamespace,
  readApiRouteSegment,
} from "@/http/shared/api-route";

describe("API route helpers", () => {
  const pattern = createExactApiRoutePattern(
    "/api/files",
    API_ROUTE_PATTERN.CAPTURED_SEGMENT,
    "download",
  );

  it("matches only the complete route shape", () => {
    expect(pattern.test("/api/files/file-1/download")).toBe(true);
    expect(pattern.test("/api/files/download")).toBe(false);
    expect(pattern.test("/api/files/file-1/download/extra")).toBe(false);
  });

  it("decodes the requested captured segment", () => {
    const match = pattern.exec("/api/files/%ED%95%9C%EA%B8%80/download");
    expect(match).not.toBeNull();
    expect(readApiRouteSegment(match!)).toBe("한글");
  });

  it("matches a namespace without accepting a prefix collision", () => {
    expect(matchesApiPathNamespace("/api/guest", "/api/guest")).toBe(true);
    expect(matchesApiPathNamespace("/api/guest/session", "/api/guest")).toBe(true);
    expect(matchesApiPathNamespace("/api/guestbook", "/api/guest")).toBe(false);
  });
});
