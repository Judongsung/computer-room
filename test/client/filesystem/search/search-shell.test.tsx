import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "@client/app";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_SEARCH_COPY } from "@client/content/ko/filesystem/search";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { renderMobile } from "@test/support/mobile/mobile-app-test-helpers";
import { desktopWindowByTitle, desktopWindowTitles, launchApplication } from "@test/client/support/desktop/app-integration-helpers";

vi.mock("react-rnd", () => ({
  Rnd: ({ children }: { readonly children: ReactNode }) => (
    <div data-testid="desktop-window">{children}</div>
  ),
}));

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

it("opens one desktop search window from Start and switches to the explorer scope", async () => {
  const filesystem = new FakeFilesystemGateway();
  const folder = await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "대상 폴더");
  const search = vi.spyOn(filesystem, "search").mockResolvedValue({
    items: [{ entry: folder, parentPath: "내 문서" }], nextOffset: null,
  });
  const user = userEvent.setup();
  render(<App api={new FakeDashboardGateway()} filesystemApi={filesystem} />);
  await launchApplication(user, FILESYSTEM_SEARCH_COPY.TITLE);
  const input = await screen.findByRole("searchbox");
  expect(search).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "대상" } });
  fireEvent.submit(input.closest("form")!);
  const searchWindow = desktopWindowByTitle(FILESYSTEM_SEARCH_COPY.TITLE);
  await user.dblClick(await within(searchWindow).findByRole("button", { name: /대상 폴더/ }));
  const explorer = await waitFor(() => desktopWindowByTitle(folder.name));
  await user.click(within(explorer).getByRole("button", { name: FILESYSTEM_SEARCH_COPY.TITLE }));
  expect(await screen.findByLabelText(FILESYSTEM_SEARCH_COPY.SCOPE)).toHaveValue(folder.id);
  expect(desktopWindowTitles().filter((title) => title === FILESYSTEM_SEARCH_COPY.TITLE)).toHaveLength(1);
  expect(screen.getByRole("searchbox")).toHaveValue("");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "범위" } });
  fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
  await waitFor(() => expect(search).toHaveBeenLastCalledWith({
    q: "범위", kind: "all", directoryId: folder.id,
  }, 0));
});

it("opens mobile search from both menus and restores criteria after viewing a result", async () => {
  const filesystem = new FakeFilesystemGateway();
  const folder = await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "사진 폴더");
  const picture = filesystem.addFile("검색 사진.png", "image/png", folder.id);
  const search = vi.spyOn(filesystem, "search").mockResolvedValue({
    items: [{ entry: picture, parentPath: "내 문서/사진 폴더" }], nextOffset: 20,
  });
  const list = vi.spyOn(filesystem, "listDirectory");
  const user = userEvent.setup();
  renderMobile({ filesystem });
  await screen.findByRole("main", { name: MOBILE_COPY.HOME_SCREEN });
  await user.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
  await user.click(screen.getByRole("button", { name: FILESYSTEM_SEARCH_COPY.TITLE }));
  const input = await screen.findByRole("searchbox");
  fireEvent.change(input, { target: { value: "사진" } });
  fireEvent.submit(input.closest("form")!);
  await user.click(await screen.findByRole("button", { name: /검색 사진.png/ }));
  await screen.findByRole("heading", { name: picture.name });
  await waitFor(() => expect(list).toHaveBeenCalledWith(folder.id, 0));
  await user.click(screen.getByRole("button", { name: MOBILE_COPY.BACK }));
  expect(await screen.findByRole("searchbox")).toHaveValue("사진");
  await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
  expect(search).toHaveBeenLastCalledWith({ q: "사진", kind: "all" }, 0);
  await user.click(await screen.findByRole("button", { name: FILESYSTEM_SEARCH_COPY.OPEN_FOLDER }));
  await screen.findByRole("heading", { name: folder.name });
  await user.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
  await user.click(screen.getByRole("button", { name: FILESYSTEM_SEARCH_COPY.TITLE }));
  expect(await screen.findByLabelText(FILESYSTEM_SEARCH_COPY.SCOPE)).toHaveValue(folder.id);
});
