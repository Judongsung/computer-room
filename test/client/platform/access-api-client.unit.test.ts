import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessApiClient } from "@client/api/platform/access-api-client";
import { ACCESS_LOGOUT_REQUEST_POLICY } from "@client/constants/platform/access";
import { API_REQUEST_OPTIONS } from "@client/constants/shared/api";

const LOGOUT_URL = "/cdn-cgi/access/logout";
afterEach(() => vi.restoreAllMocks());

describe("Access API client", () => {
  it("requests the Cloudflare logout endpoint without using a cached response", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await new AccessApiClient().logout(LOGOUT_URL);

    expect(fetchSpy).toHaveBeenCalledWith(LOGOUT_URL, {
      method: "GET",
      credentials: API_REQUEST_OPTIONS.CREDENTIALS,
      cache: ACCESS_LOGOUT_REQUEST_POLICY.CACHE,
    });
  });
});
