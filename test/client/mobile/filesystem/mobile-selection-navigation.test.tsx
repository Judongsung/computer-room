import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MobileDirectory } from "@client/components/mobile/filesystem/mobile-directory";
import { useMobileNavigation } from "@client/hooks/shared/use-mobile-navigation";
import { ThumbnailLoadProvider } from "@client/state/filesystem/thumbnail-load-context";
import { MOBILE_ACTIVITY_KIND } from "@client/constants/mobile/activity";
import { FILESYSTEM_COPY as COPY } from "@client/content/ko/filesystem/filesystem";
import { MOBILE_FILESYSTEM_COPY as MOBILE_FILES } from "@client/content/ko/mobile/filesystem";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { renderMobile } from "@test/support/mobile/mobile-app-test-helpers";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
});

it("selects loaded entries only and removes disappeared selections after refresh", async () => {
  const gateway = new FakeFilesystemGateway();
  const first = gateway.addFile("first.txt", "text/plain");
  const second = gateway.addFile("second.txt", "text/plain");
  const page = await gateway.listDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS);
  vi.spyOn(gateway, "listDirectory")
    .mockResolvedValueOnce({ ...page, items: [first], nextOffset: 20 })
    .mockResolvedValueOnce({ ...page, items: [second], nextOffset: null })
    .mockResolvedValue({ ...page, items: [second], nextOffset: null });
  const props = { gateway, directoryId: FILESYSTEM_ROOT_ID.DOCUMENTS, title: "Documents", menuOpen: true,
    onCloseMenu: vi.fn(), onSearch: vi.fn(), onRefresh: vi.fn(), onChanged: vi.fn(), onUpload: vi.fn(),
    onOpenEntry: vi.fn(), onOpenDirectory: vi.fn(), onGuardChange: vi.fn() };
  const view = render(<MobileDirectory {...props} revision={0} />, { wrapper: ThumbnailLoadProvider });
  await screen.findByText(first.name);
  fireEvent.click(screen.getByRole("button", { name: MOBILE_FILES.SELECT }));
  fireEvent.click(screen.getByRole("button", { name: MOBILE_FILES.SELECT_ALL }));
  fireEvent.click(screen.getByRole("button", { name: COPY.LOAD_MORE }));
  expect(await screen.findByRole("checkbox", { name: second.name })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: first.name })).toBeChecked();
  view.rerender(<MobileDirectory {...props} revision={1} />);
  await waitFor(() => expect(screen.queryByRole("checkbox", { name: first.name })).not.toBeInTheDocument());
  expect(screen.getByRole("checkbox", { name: second.name })).not.toBeChecked();
});

it("restores browser history when navigation is blocked and permits the next back", async () => {
  const guard = vi.fn(() => false);
  const view = renderHook(() => useMobileNavigation({ kind: MOBILE_ACTIVITY_KIND.HOME }, guard));
  act(() => view.result.current.push({ kind: MOBILE_ACTIVITY_KIND.DIRECTORY, directoryId: "folder", title: "Folder" }));
  await act(() => new Promise<void>((resolve) => {
    window.addEventListener("popstate", () => resolve(), { once: true });
    history.back();
  }));
  await waitFor(() => expect(history.state.computerRoomMobileDepth).toBe(1));
  expect(guard).toHaveBeenCalledTimes(1);
  expect(view.result.current.current.kind).toBe(MOBILE_ACTIVITY_KIND.DIRECTORY);
  guard.mockReturnValue(true);
  act(() => view.result.current.back());
  await waitFor(() => expect(view.result.current.current.kind).toBe(MOBILE_ACTIVITY_KIND.HOME));
});

it("consumes back for a file dialog and then for selection before leaving the folder", async () => {
  const gateway = new FakeFilesystemGateway();
  const entry = gateway.addFile("rename.txt", "text/plain");
  renderMobile({ filesystem: gateway });
  fireEvent.click(await screen.findByRole("button", { name: MOBILE_COPY.MY_DOCUMENTS }));
  await screen.findByText(entry.name);
  fireEvent.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
  fireEvent.click(screen.getByRole("button", { name: MOBILE_FILES.SELECT }));
  fireEvent.click(screen.getByRole("checkbox", { name: entry.name }));
  fireEvent.click(screen.getByRole("button", { name: COPY.RENAME }));
  fireEvent.click(screen.getByRole("button", { name: MOBILE_COPY.BACK }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(history.state.computerRoomMobileDepth).toBe(1));
  expect(screen.getByRole("checkbox", { name: entry.name })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: MOBILE_COPY.BACK }));
  await waitFor(() => expect(screen.queryByRole("checkbox")).not.toBeInTheDocument());
  await waitFor(() => expect(history.state.computerRoomMobileDepth).toBe(1));
  expect(screen.getByRole("heading", { name: MOBILE_COPY.MY_DOCUMENTS })).toBeInTheDocument();
});
