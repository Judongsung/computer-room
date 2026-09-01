import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_GUEST_LANDING_PATH,
  ACCESS_MODE_OWNER_VALUE,
} from "@/constants/platform/auth";
import { AccessApiClient } from "@client/api/platform/access-api-client";
import {
  ACCESS_LOGOUT_REQUEST_POLICY,
  OWNER_ACCESS_STORAGE_KEY,
} from "@client/constants/platform/access";
import { API_REQUEST_OPTIONS } from "@client/constants/shared/api";
import { useAccessLogout } from "@client/hooks/platform/use-access-logout";
import type {
  AccessLogoutGateway,
  AccessLogoutNavigator,
} from "@client/types/platform/access";

const LOGOUT_URL = "/cdn-cgi/access/logout";

describe("Access logout", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

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

  it("clears owner mode and returns to the public guest landing page", async () => {
    localStorage.setItem(OWNER_ACCESS_STORAGE_KEY, ACCESS_MODE_OWNER_VALUE);
    const gateway = resolvedGateway();
    const navigator = fakeNavigator();
    const { result } = renderHook(() =>
      useAccessLogout(LOGOUT_URL, { gateway, navigator }),
    );

    await act(async () => result.current.logout());

    expect(localStorage.getItem(OWNER_ACCESS_STORAGE_KEY)).toBeNull();
    expect(gateway.logout).toHaveBeenCalledWith(LOGOUT_URL);
    expect(navigator.replace).toHaveBeenCalledWith(ACCESS_GUEST_LANDING_PATH);
    expect(navigator.assign).not.toHaveBeenCalled();
  });

  it("falls back to the provider logout page when the background request fails", async () => {
    const gateway: AccessLogoutGateway = {
      logout: vi.fn().mockRejectedValue(new Error("network failure")),
    };
    const navigator = fakeNavigator();
    const { result } = renderHook(() =>
      useAccessLogout(LOGOUT_URL, { gateway, navigator }),
    );

    await act(async () => result.current.logout());

    expect(navigator.replace).not.toHaveBeenCalled();
    expect(navigator.assign).toHaveBeenCalledWith(LOGOUT_URL);
    await waitFor(() => expect(result.current.isLoggingOut).toBe(false));
  });

  it("does not send duplicate logout requests while one is in progress", async () => {
    let resolveLogout!: () => void;
    const gateway: AccessLogoutGateway = {
      logout: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveLogout = resolve;
          }),
      ),
    };
    const navigator = fakeNavigator();
    const { result } = renderHook(() =>
      useAccessLogout(LOGOUT_URL, { gateway, navigator }),
    );

    let firstLogout!: Promise<void>;
    act(() => {
      firstLogout = result.current.logout();
      void result.current.logout();
    });
    expect(gateway.logout).toHaveBeenCalledOnce();

    await act(async () => {
      resolveLogout();
      await firstLogout;
    });
  });
});

function resolvedGateway(): AccessLogoutGateway {
  return { logout: vi.fn().mockResolvedValue(undefined) };
}

function fakeNavigator(): AccessLogoutNavigator {
  return {
    replace: vi.fn(),
    assign: vi.fn(),
  };
}
