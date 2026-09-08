import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGuestProgramWindows } from "@client/hooks/guest/use-guest-program-windows";
import { GuestMobileProgramDocument } from "@client/components/mobile/guest/guest-mobile-program-document";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import type { GuestProgramDocument } from "@/types/guest/guest";
import { deferred } from "@test/support/widgets/deferred";
import { guestGateway, program } from "@test/support/guest/program-fixtures";

const desktop = { width: 1000, height: 800 };

describe("guest program refresh regressions", () => {
  it("retains a failed window's error when a later window succeeds", async () => {
    const gateway = guestGateway();
    const { result } = renderHook(() => useGuestProgramWindows(gateway));
    await act(async () => { await result.current.open(program("a").entry, desktop); });
    await act(async () => { await result.current.open(program("b").entry, desktop); });
    const first = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockImplementationOnce(() => first.promise).mockResolvedValueOnce(program("b", "updated"));
    act(() => window.dispatchEvent(new Event("focus")));
    await act(async () => first.reject(new Error("private failure")));
    expect(result.current.error).toBe(GUEST_COPY.PROGRAM_LOAD_FAILED);
    expect(result.current.windows[1]?.data).toEqual(program("b", "updated").data);
  });

  it("ignores a mobile refresh that finishes after switching documents", async () => {
    const gateway = guestGateway();
    const { rerender } = render(<GuestMobileProgramDocument entryId="a" title="a" gateway={gateway} />);
    await screen.findByText("a", { selector: "span" });
    await act(async () => {});
    const old = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockImplementationOnce(() => old.promise);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(2);
    rerender(<GuestMobileProgramDocument entryId="b" title="b" gateway={gateway} />);
    await screen.findByText("b", { selector: "span" });
    await act(async () => old.resolve(program("a")));
    expect(screen.getByText("b", { selector: "span" })).toBeInTheDocument();
  });
});
