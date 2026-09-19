import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "@client/app";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_SEARCH_COPY } from "@client/content/ko/filesystem/search";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import { deferred } from "@test/support/widgets/deferred";
import type { FilesystemSearchPage } from "@/types/filesystem/search/search";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { renderMobile } from "@test/support/mobile/mobile-app-test-helpers";
import { desktopWindowByTitle, desktopWindowTitles, openStartMenu } from "@test/client/support/desktop/app-integration-helpers";

vi.mock("react-rnd", () => ({
  Rnd: ({ children }: { readonly children: ReactNode }) => (
    <div data-testid="desktop-window">{children}</div>
  ),
}));

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

it("searches inside the explorer, blocks hidden-list commands and restores the list on close", async () => {
  const filesystem = new FakeFilesystemGateway();
  const folder = await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "대상 폴더");
  filesystem.addFile("일반 목록.txt", "text/plain");
  const file = filesystem.addFile("찾은 파일.txt", "text/plain", folder.id);
  const search = vi.spyOn(filesystem, "search").mockResolvedValue({
    items: [{ entry: file, parentPath: "내 문서/대상 폴더" }], nextOffset: null,
  });
  const upload = vi.spyOn(filesystem, "uploadFile");
  const list = vi.spyOn(filesystem, "listDirectory");
  const user = userEvent.setup();
  render(<App api={new FakeDashboardGateway()} filesystemApi={filesystem} />);
  await openStartMenu(user);
  expect(screen.queryByRole("button", { name: FILESYSTEM_SEARCH_COPY.TITLE })).not.toBeInTheDocument();
  await user.dblClick(within(screen.getByRole("navigation", { name: FILESYSTEM_COPY.DESKTOP_SHORTCUTS })).getByRole("button", { name: "내 문서" }));
  const explorer = await waitFor(() => desktopWindowByTitle("내 문서"));
  await user.click(await within(explorer).findByRole("button", { name: /일반 목록.txt/ }));
  await user.click(within(explorer).getByRole("button", { name: FILESYSTEM_SEARCH_COPY.TITLE }));
  expect(within(explorer).getByRole("complementary", { name: FILESYSTEM_SEARCH_COPY.TITLE })).toBeInTheDocument();
  expect(within(explorer).getByText("일반 목록.txt")).toBeInTheDocument();
  expect(search).not.toHaveBeenCalled();
  const input = within(explorer).getByRole("searchbox");
  fireEvent.change(input, { target: { value: "찾은" } });
  fireEvent.submit(input.closest("form")!);
  await within(explorer).findByText("찾은 파일.txt");
  expect(search).toHaveBeenLastCalledWith({ q: "찾은", kind: "all", directoryId: FILESYSTEM_ROOT_ID.DOCUMENTS }, 0);
  expect(desktopWindowTitles()).toEqual(["내 문서"]);
  expect(within(explorer).queryByText("일반 목록.txt")).not.toBeInTheDocument();
  for (const name of [FILESYSTEM_COPY.NEW_FOLDER, FILESYSTEM_COPY.UPLOAD_FILES, FILESYSTEM_COPY.DELETE, FILESYSTEM_COPY.DOWNLOAD]) {
    expect(within(explorer).getByRole("button", { name })).toBeDisabled();
  }
  const dataTransfer = { types: ["Files"], files: [new File(["x"], "drop.txt")], items: [], getData: () => "" };
  fireEvent.drop(explorer.querySelector(".explorer-search-layout")!, { dataTransfer });
  fireEvent.drop(within(explorer).getByRole("button", { name: "내 문서" }), { dataTransfer });
  fireEvent.change(explorer.querySelector('input[type="file"]')!, { target: { files: dataTransfer.files } });
  expect(upload).not.toHaveBeenCalled();
  await user.click(within(explorer).getByRole("menuitem", { name: XP_EXPLORER_HEADER_COPY.VIEW_MENU }));
  expect(screen.getAllByRole("menuitemradio").every((item) => item.getAttribute("aria-disabled") === "true")).toBe(true);
  const listCalls = list.mock.calls.length;
  await user.click(screen.getByRole("menuitem", { name: FILESYSTEM_COPY.REFRESH }));
  await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
  expect(list).toHaveBeenCalledTimes(listCalls);
  await user.click(within(explorer).getByRole("button", { name: FILESYSTEM_SEARCH_COPY.CLOSE }));
  expect(within(explorer).getByText("일반 목록.txt")).toBeInTheDocument();
  expect(within(explorer).queryByRole("searchbox")).not.toBeInTheDocument();
  expect(within(explorer).getByRole("button", { name: FILESYSTEM_COPY.DELETE })).toBeDisabled();
});

it("keeps windows independent and resets search on same-window folder navigation", async () => {
  const filesystem = new FakeFilesystemGateway();
  const desktopFolder = await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "별도 폴더");
  const child = await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "하위 폴더");
  const pending = deferred<FilesystemSearchPage>();
  const search = vi.spyOn(filesystem, "search")
    .mockResolvedValueOnce({ items: [{ entry: child, parentPath: "내 문서" }], nextOffset: null })
    .mockReturnValue(pending.promise);
  const user = userEvent.setup();
  render(<App api={new FakeDashboardGateway()} filesystemApi={filesystem} />);
  await user.dblClick(await screen.findByRole("button", { name: desktopFolder.name }));
  await user.dblClick(within(screen.getByRole("navigation", { name: FILESYSTEM_COPY.DESKTOP_SHORTCUTS })).getByRole("button", { name: "내 문서" }));
  const explorer = await waitFor(() => desktopWindowByTitle("내 문서"));
  await user.click(within(explorer).getByRole("button", { name: FILESYSTEM_SEARCH_COPY.TITLE }));
  expect(within(desktopWindowByTitle(desktopFolder.name)).queryByRole("searchbox")).not.toBeInTheDocument();
  let input = within(explorer).getByRole("searchbox");
  fireEvent.change(input, { target: { value: "하위" } });
  fireEvent.submit(input.closest("form")!);
  await user.dblClick(await within(explorer).findByRole("button", { name: /하위 폴더/ }));
  await waitFor(() => expect(desktopWindowTitles()).toEqual([desktopFolder.name, child.name]));
  input = within(explorer).getByRole("searchbox");
  expect(input).toHaveValue("");
  expect(within(explorer).getByText(`${FILESYSTEM_SEARCH_COPY.SCOPE}: ${child.name}`)).toBeInTheDocument();
  expect(search).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: "늦은" } });
  fireEvent.submit(input.closest("form")!);
  expect(search).toHaveBeenLastCalledWith({ q: "늦은", kind: "all", directoryId: child.id }, 0);
  await user.click(within(explorer).getByRole("button", { name: FILESYSTEM_COPY.UP }));
  await waitFor(() => expect(input).toHaveValue(""));
  await act(async () => pending.reject(new Error("stale folder")));
  expect(within(explorer).queryByRole("alert")).not.toBeInTheDocument();
  expect(within(explorer).getByText(`${FILESYSTEM_SEARCH_COPY.SCOPE}: 내 문서`)).toBeInTheDocument();
});


it("opens mobile search only from a folder and restores criteria after viewing a result", async () => {
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
  expect(screen.queryByRole("button", { name: FILESYSTEM_SEARCH_COPY.TITLE })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
  await user.click(screen.getByRole("button", { name: MOBILE_COPY.MY_DOCUMENTS }));
  await screen.findByRole("button", { name: /사진 폴더/ });
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
  expect(search).toHaveBeenLastCalledWith({ q: "사진", kind: "all", directoryId: FILESYSTEM_ROOT_ID.DOCUMENTS }, 0);
  await user.click(await screen.findByRole("button", { name: FILESYSTEM_SEARCH_COPY.OPEN_FOLDER }));
  await screen.findByRole("heading", { name: folder.name });
  await user.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
  await user.click(screen.getByRole("button", { name: FILESYSTEM_SEARCH_COPY.TITLE }));
  expect(await screen.findByText(`${FILESYSTEM_SEARCH_COPY.SCOPE}: ${folder.name}`)).toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: FILESYSTEM_SEARCH_COPY.SCOPE })).not.toBeInTheDocument();
});
