import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WINDOW_STATE } from "@/constants/widgets/widget";
import { useNotepadWindows } from "@client/hooks/filesystem/text/use-notepad-windows";
import { fileEntry } from "@test/support/filesystem/file-entry";

const desktop = { width: 1024, height: 606 };
const file = fileEntry("text", "notes.txt", "text/plain");

describe("session notepad windows", () => {
  it("deduplicates simultaneous opens by entry ID and maintains relative order", () => {
    const { result } = renderHook(() => useNotepadWindows());
    let id = "";
    act(() => {
      id = result.current.open(file, desktop);
      expect(result.current.open(file, desktop)).toBe(id);
      result.current.open({ ...file, id: "second" }, desktop);
    });
    expect(result.current.windows).toHaveLength(2);
    const order = result.current.registrations.map((item) => item.id);
    act(() => { result.current.minimize(id); });
    expect(result.current.windows[0]?.windowState).toBe(WINDOW_STATE.MINIMIZED);
    act(() => { result.current.open(file, desktop); });
    expect(result.current.windows[0]?.windowState).toBe(WINDOW_STATE.NORMAL);
    expect(result.current.registrations.map((item) => item.id)).toEqual(order);
  });
  it("preserves maximized restore state and commits bounds only in the session", () => {
    const { result, unmount } = renderHook(() => useNotepadWindows());
    let id = "";
    act(() => { id = result.current.open(file, desktop); });
    act(() => { result.current.toggleMaximize(id); });
    act(() => { result.current.minimize(id); });
    act(() => { result.current.open(file, desktop); });
    expect(result.current.windows[0]?.windowState).toBe(WINDOW_STATE.MAXIMIZED);
    act(() => { result.current.toggleMaximize(id); });
    const bounds = { position: { x: 80, y: 60 }, size: { width: 500, height: 350 } };
    act(() => { result.current.commitBounds(id, bounds); });
    expect(result.current.windows[0]).toMatchObject(bounds);
    unmount();
    const nextSession = renderHook(() => useNotepadWindows());
    expect(nextSession.result.current.windows).toHaveLength(0);
  });
  it("removes a closed window from registrations and opens a fresh one later", () => {
    const { result } = renderHook(() => useNotepadWindows());
    let id = "";
    act(() => { id = result.current.open(file, desktop); });
    act(() => { result.current.registrations[0]?.close?.(); });
    expect(result.current.registrations).toHaveLength(0);
    act(() => { result.current.open(file, desktop); });
    expect(result.current.windows[0]?.id).toBe(id);
  });
});
