import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WINDOW_STATE } from "@/constants/widgets/widget";
import type { GuestProgramDocument } from "@/types/guest/guest";
import { useGuestProgramWindows } from "@client/hooks/guest/use-guest-program-windows";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { deferred } from "@test/support/widgets/deferred";
import { guestGateway, program } from "@test/support/guest/program-fixtures";

const desktop = { width: 1000, height: 800 };
const focus = () => window.dispatchEvent(new Event("focus"));

describe("guest program windows", () => {
  afterEach(() => vi.useRealTimers());

  it.each(["a", "b"])("aggregates a failure in %s, shares a sequential batch and recovers on success", async (failedId) => {
    const gateway = guestGateway();
    const { result } = renderHook(() => useGuestProgramWindows(gateway));
    await act(async () => { await result.current.open(program("a").entry, desktop); await result.current.open(program("b").entry, desktop); });
    const first = deferred<GuestProgramDocument>();
    const second = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockClear().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    act(() => { focus(); document.dispatchEvent(new Event("visibilitychange")); focus(); });
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(1);
    await act(async () => { if (failedId === "a") first.reject(new Error("private")); else first.resolve(program("a", "new a")); });
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    await act(async () => { if (failedId === "b") second.reject(new Error("private")); else second.resolve(program("b", "new b")); });
    expect(result.current.error).toBe(GUEST_COPY.PROGRAM_LOAD_FAILED);
    expect(result.current.windows.find(w => w.file?.entryId === failedId)?.data).toEqual(program(failedId).data);
    const successId = failedId === "a" ? "b" : "a";
    expect(result.current.windows.find(w => w.file?.entryId === successId)?.data).toEqual(program(successId, "new " + successId).data);
    await act(async () => { focus(); });
    expect(result.current.error).toBeNull();
  });

  it("shares pending opens, reports failure internally and retries without duplicate windows", async () => {
    const gateway = guestGateway();
    const pending = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockImplementationOnce(() => pending.promise);
    const { result } = renderHook(() => useGuestProgramWindows(gateway));
    let first!: Promise<string | null>;
    act(() => { first = result.current.open(program("a").entry, desktop); expect(result.current.open(program("a").entry, desktop)).toBe(first); });
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(1);
    await act(async () => { pending.reject(new Error("internal")); expect(await first).toBeNull(); });
    expect(result.current.windows).toHaveLength(0);
    expect(result.current.error).toBe(GUEST_COPY.PROGRAM_LOAD_FAILED);
    await act(async () => { await result.current.open(program("a").entry, desktop); await result.current.open(program("a").entry, desktop); });
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(2);
    expect(result.current.windows).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it.each(["success", "failure"])("ignores old %s after closing and reopening a document", async (outcome) => {
    const gateway = guestGateway();
    const { result } = renderHook(() => useGuestProgramWindows(gateway));
    await act(async () => { await result.current.open(program("a").entry, desktop); });
    const id = result.current.windows[0]!.id;
    const old = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockImplementationOnce(() => old.promise);
    act(focus);
    act(() => result.current.close(id));
    gateway.getProgramDocument.mockResolvedValueOnce(program("a", "reopened"));
    await act(async () => { await result.current.open(program("a").entry, desktop); });
    await act(async () => { if (outcome === "success") old.resolve(program("a", "stale")); else old.reject(new Error("stale")); });
    expect(result.current.windows).toHaveLength(1);
    expect(result.current.windows[0]!.id).not.toBe(id);
    expect(result.current.windows[0]!.data).toEqual(program("a", "reopened").data);
    expect(result.current.error).toBeNull();
  });

  it("creates one window for concurrent successful opens", async () => {
    const gateway = guestGateway();
    const pending = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockImplementationOnce(() => pending.promise);
    const { result } = renderHook(() => useGuestProgramWindows(gateway));
    let first!: Promise<string | null>; let second!: Promise<string | null>;
    act(() => { first = result.current.open(program("a").entry, desktop); second = result.current.open(program("a").entry, desktop); });
    await act(async () => { pending.resolve(program("a")); expect(await first).toBe(await second); });
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(1);
    expect(result.current.windows).toHaveLength(1);
  });

  it("skips a closed queued window and does not restore an already dismissed batch error", async () => {
    const gateway = guestGateway();
    const { result } = renderHook(() => useGuestProgramWindows(gateway));
    await act(async () => { await result.current.open(program("a").entry, desktop); await result.current.open(program("b").entry, desktop); });
    const pending = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockClear().mockImplementationOnce(() => pending.promise);
    act(focus);
    act(() => { result.current.close(result.current.windows[1]!.id); result.current.clearError(); });
    await act(async () => pending.reject(new Error("dismissed")));
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it("preserves moved bounds and minimization when a read completes", async () => {
    const gateway = guestGateway();
    const { result } = renderHook(() => useGuestProgramWindows(gateway));
    await act(async () => { await result.current.open(program("a").entry, desktop); });
    const pending = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockImplementationOnce(() => pending.promise);
    act(focus);
    const id = result.current.windows[0]!.id;
    const bounds = { position: { x: 42, y: 67 }, size: { width: 450, height: 400 } };
    act(() => { result.current.commitBounds(id, bounds); result.current.minimize(id); });
    await act(async () => pending.resolve(program("a", "new")));
    expect(result.current.windows[0]).toMatchObject({ ...bounds, windowState: WINDOW_STATE.MINIMIZED, data: program("a", "new").data });
  });

  it.each([
    ["gateway", "success"], ["gateway", "failure"], ["unmount", "success"], ["unmount", "failure"],
  ])("stops the old batch and pending opens after %s on %s", async (change, outcome) => {
    const gateway = guestGateway();
    const { result, rerender, unmount } = renderHook(({ api }) => useGuestProgramWindows(api), { initialProps: { api: gateway } });
    await act(async () => { await result.current.open(program("a").entry, desktop); await result.current.open(program("b").entry, desktop); });
    const old = deferred<GuestProgramDocument>(); const opening = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockClear().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => opening.promise);
    let oldOpen!: Promise<string | null>;
    act(() => { focus(); oldOpen = result.current.open(program("c").entry, desktop); });
    const nextGateway = guestGateway();
    if (change === "gateway") {
      rerender({ api: nextGateway });
      expect(result.current.windows).toHaveLength(0);
      await act(async () => { await result.current.open(program("next").entry, desktop); });
    } else unmount();
    await act(async () => {
      if (outcome === "success") { old.resolve(program("a")); opening.resolve(program("c")); }
      else { old.reject(new Error("old")); opening.reject(new Error("old")); }
      expect(await oldOpen).toBeNull();
    });
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(2);
    if (change === "gateway") {
      expect(result.current.windows).toHaveLength(1);
      expect(result.current.windows[0]?.file?.entryId).toBe("next");
      expect(result.current.error).toBeNull();
      await act(async () => { focus(); });
      expect(nextGateway.getProgramDocument).toHaveBeenCalledTimes(2);
    }
  });

  it("clears dismissed or closed errors, but reports a new failed request", async () => {
    const gateway = guestGateway();
    const { result } = renderHook(() => useGuestProgramWindows(gateway));
    await act(async () => { await result.current.open(program("a").entry, desktop); });
    gateway.getProgramDocument.mockRejectedValue(new Error("failure"));
    await act(async () => { focus(); });
    expect(result.current.error).toBe(GUEST_COPY.PROGRAM_LOAD_FAILED);
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
    await act(async () => { focus(); });
    expect(result.current.error).toBe(GUEST_COPY.PROGRAM_LOAD_FAILED);
    act(() => result.current.close(result.current.windows[0]!.id));
    expect(result.current.error).toBeNull();
  });

  it("refreshes at midnight without retrying a failed boundary forever", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T14:59:59Z"));
    const doc = program("a");
    const gateway = guestGateway();
    gateway.getProgramDocument.mockResolvedValueOnce({ ...doc, data: { ...doc.data, nextResetAt: "2026-09-08T15:00:00Z" } })
      .mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useGuestProgramWindows(gateway));
    await act(async () => { await result.current.open(doc.entry, desktop); });
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(60000));
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(2);
  });
});
