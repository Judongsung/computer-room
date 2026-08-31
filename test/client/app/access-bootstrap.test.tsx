import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionInfo } from "@/types/platform/auth";
import { ACCESS_MODE_OWNER_VALUE } from "@/constants/platform/auth";
import {
  ACCESS_BOOTSTRAP_STATUS,
  OWNER_ACCESS_STORAGE_KEY,
} from "@client/constants/platform/access";
import { useAccessBootstrap } from "@client/hooks/platform/use-access-bootstrap";

const OWNER_SESSION: SessionInfo = {
  email: "owner@example.com",
  logoutUrl: "/logout",
  filePolicy: { maxUploadSizeBytes: 100 },
};
const GUEST_SESSION = { enabled: true, loginUrl: "/auth/login" } as const;

describe("useAccessBootstrap", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("loads the guest session without probing the owner endpoint by default", async () => {
    const owner = { getSession: vi.fn().mockResolvedValue(OWNER_SESSION) };
    const guest = { getSession: vi.fn().mockResolvedValue(GUEST_SESSION) };
    const { result } = renderHook(() => useAccessBootstrap({ owner, guest }));

    await waitFor(() =>
      expect(result.current.state.status).toBe(ACCESS_BOOTSTRAP_STATUS.GUEST),
    );
    expect(owner.getSession).not.toHaveBeenCalled();
    expect(guest.getSession).toHaveBeenCalledOnce();
  });

  it("consumes an owner query, remembers it, and probes the protected session", async () => {
    window.history.replaceState({}, "", "/?access=owner");
    const owner = { getSession: vi.fn().mockResolvedValue(OWNER_SESSION) };
    const guest = { getSession: vi.fn().mockResolvedValue(GUEST_SESSION) };
    const { result } = renderHook(() => useAccessBootstrap({ owner, guest }));

    await waitFor(() =>
      expect(result.current.state.status).toBe(ACCESS_BOOTSTRAP_STATUS.OWNER),
    );
    expect(window.location.search).toBe("");
    expect(localStorage.getItem(OWNER_ACCESS_STORAGE_KEY)).toBe(
      ACCESS_MODE_OWNER_VALUE,
    );
    expect(guest.getSession).not.toHaveBeenCalled();
  });

  it("clears a stale owner hint and falls back to the guest session", async () => {
    localStorage.setItem(OWNER_ACCESS_STORAGE_KEY, ACCESS_MODE_OWNER_VALUE);
    const owner = { getSession: vi.fn().mockRejectedValue(new Error("401")) };
    const guest = { getSession: vi.fn().mockResolvedValue(GUEST_SESSION) };
    const { result } = renderHook(() => useAccessBootstrap({ owner, guest }));

    await waitFor(() =>
      expect(result.current.state.status).toBe(ACCESS_BOOTSTRAP_STATUS.GUEST),
    );
    expect(owner.getSession).toHaveBeenCalledOnce();
    expect(localStorage.getItem(OWNER_ACCESS_STORAGE_KEY)).toBeNull();
  });
});
