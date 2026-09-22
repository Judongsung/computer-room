import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useShortcutOpening } from "@client/hooks/filesystem/shortcuts/use-shortcut-opening";
import { ShortcutCreateDialog } from "@client/components/desktop/filesystem/shortcut-create-dialog";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { deferred } from "@test/support/widgets/deferred";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { FilesystemShortcutTarget } from "@/types/filesystem/filesystem";

async function setup() {
  const gateway = new FakeFilesystemGateway();
  const target = gateway.addFile("original.txt", "text/plain");
  const link = await gateway.createShortcut({ targetEntryId: target.id, parentId: FILESYSTEM_ROOT_ID.DESKTOP, name: "Shortcut" });
  return { gateway, target, link };
}

describe("shortcut opening", () => {
  it("deduplicates opening, reports failure and permits retry with the original entry", async () => {
    const { gateway, target, link } = await setup();
    const pending = deferred<FilesystemShortcutTarget>();
    const resolve = vi.spyOn(gateway, "resolveShortcut").mockReturnValueOnce(pending.promise);
    const onOpen = vi.fn();
    const { result } = renderHook(() => useShortcutOpening(gateway, "folder", onOpen));
    act(() => { result.current.open(link); result.current.open(link); });
    expect(resolve).toHaveBeenCalledTimes(1);
    await act(async () => pending.reject(new Error("unavailable")));
    expect(onOpen).not.toHaveBeenCalled();
    expect(result.current.error).not.toBeNull();
    await act(async () => result.current.open(link));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(target);
    expect(result.current.error).toBeNull();
  });

  it.each(["location", "gateway", "unmount"] as const)("ignores responses after %s changes", async (change) => {
    const { gateway, target, link } = await setup();
    const pending = deferred<FilesystemShortcutTarget>();
    vi.spyOn(gateway, "resolveShortcut").mockReturnValue(pending.promise);
    const onOpen = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ api, location }) => useShortcutOpening(api, location, onOpen),
      { initialProps: { api: gateway, location: "first" } },
    );
    act(() => result.current.open(link));
    if (change === "unmount") unmount();
    else rerender({ api: change === "gateway" ? new FakeFilesystemGateway() : gateway, location: change === "location" ? "second" : "first" });
    await act(async () => pending.resolve(target));
    expect(onOpen).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("creates in the selected location and preserves an edited name after failure", async () => {
    const { gateway, target } = await setup();
    const create = vi.spyOn(gateway, "createShortcut").mockRejectedValueOnce(new Error("failed"));
    const onCreated = vi.fn();
    render(<ShortcutCreateDialog gateway={gateway} entry={target} desktopCapacity={20} onCreated={onCreated} onCancel={vi.fn()} />);
    const name = screen.getByRole("textbox");
    expect(name).toHaveValue("original.txt - 바로가기");
    fireEvent.change(name, { target: { value: "My document" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "여기에 만들기" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "여기에 만들기" }));
    await screen.findByRole("alert");
    expect(name).toHaveValue("My document");
    expect(onCreated).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "여기에 만들기" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenLastCalledWith({ targetEntryId: target.id, parentId: FILESYSTEM_ROOT_ID.DESKTOP, name: "My document", desktopPlacement: { targetIndex: 0, capacity: 20 } });
  });
});
