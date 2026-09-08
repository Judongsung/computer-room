import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestMobileProgramDocument } from "@client/components/mobile/guest/guest-mobile-program-document";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import type { GuestProgramDocument } from "@/types/guest/guest";
import { deferred } from "@test/support/widgets/deferred";
import { guestGateway, program } from "@test/support/guest/program-fixtures";

const focus = () => window.dispatchEvent(new Event("focus"));

describe("guest mobile document", () => {
  afterEach(() => vi.useRealTimers());

  it("retries an initial failure and keeps the error until the retry succeeds", async () => {
    const gateway = guestGateway();
    const retry = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockRejectedValueOnce(new Error("private details")).mockImplementationOnce(() => retry.promise);
    render(<GuestMobileProgramDocument entryId="a" title="title" gateway={gateway} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(GUEST_COPY.PROGRAM_LOAD_FAILED);
    expect(screen.queryByText("private details")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "다시 시도" }));
    expect(screen.getByRole("alert")).toHaveTextContent(GUEST_COPY.PROGRAM_LOAD_FAILED);
    await act(async () => retry.resolve(program("a")));
    expect(screen.getByText("a", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "편집" })).not.toBeInTheDocument();
  });

  it("shares focus and visibility requests and retains data through a failed refresh", async () => {
    const gateway = guestGateway();
    render(<GuestMobileProgramDocument entryId="a" title="title" gateway={gateway} />);
    await screen.findByText("a", { selector: "span" });
    await act(async () => {});
    const refresh = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockImplementationOnce(() => refresh.promise);
    act(() => { focus(); document.dispatchEvent(new Event("visibilitychange")); focus(); });
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(2);
    await act(async () => refresh.reject(new Error("offline")));
    expect(screen.getByText("a", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    gateway.getProgramDocument.mockResolvedValueOnce(program("a", "new"));
    await userEvent.setup().click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("new")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["target", "gateway"])("ignores old errors and protects loading after a %s change", async (change) => {
    const gateway = guestGateway();
    const { rerender } = render(<GuestMobileProgramDocument entryId="a" title="title" gateway={gateway} />);
    await screen.findByText("a", { selector: "span" });
    await act(async () => {});
    const old = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockImplementationOnce(() => old.promise);
    act(focus);
    const fresh = deferred<GuestProgramDocument>();
    const next = change === "gateway" ? guestGateway() : gateway;
    next.getProgramDocument.mockImplementationOnce(() => fresh.promise);
    rerender(<GuestMobileProgramDocument entryId={change === "target" ? "b" : "a"} title="next" gateway={next} />);
    expect(screen.queryByText("a", { selector: "span" })).not.toBeInTheDocument();
    await act(async () => old.reject(new Error("old")));
    expect(screen.getByText("연결하는 중…")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => fresh.resolve(program("b", "new")));
    expect(screen.getByText("new")).toBeInTheDocument();
  });

  it("ignores a refresh after unmount without retrying", async () => {
    const gateway = guestGateway();
    const { unmount } = render(<GuestMobileProgramDocument entryId="a" title="title" gateway={gateway} />);
    await screen.findByText("a", { selector: "span" });
    await act(async () => {});
    const old = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockImplementationOnce(() => old.promise);
    act(focus);
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => old.reject(new Error("old")));
    act(focus);
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shares a midnight refresh with focus and displays the new business date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T14:59:59Z"));
    const gateway = guestGateway();
    const doc = program("a");
    gateway.getProgramDocument.mockResolvedValueOnce({ ...doc, data: { ...doc.data, nextResetAt: "2026-09-08T15:00:00Z" } });
    render(<GuestMobileProgramDocument entryId="a" title="title" gateway={gateway} />);
    await act(async () => {});
    const pending = deferred<GuestProgramDocument>();
    gateway.getProgramDocument.mockImplementationOnce(() => pending.promise);
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    act(focus);
    expect(gateway.getProgramDocument).toHaveBeenCalledTimes(2);
    await act(async () => pending.resolve({ ...doc, data: { ...doc.data, businessDate: "2026-09-09" } }));
    expect(screen.getByText(/2026-09-09 체크리스트/)).toBeInTheDocument();
  });
});
