import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "@client/app";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { renderMobile } from "@test/support/mobile/mobile-app-test-helpers";
import { desktopWindowByTitle, desktopWindowTitles } from "@test/client/support/desktop/app-integration-helpers";

vi.mock("react-rnd", () => ({ Rnd: ({ children }: { readonly children: ReactNode }) => <div data-testid="desktop-window">{children}</div> }));
beforeEach(() => { localStorage.clear(); history.replaceState(null, "", "/"); });

it("creates from an explorer menu and opens the folder target in the same explorer", async () => {
  const filesystem = new FakeFilesystemGateway();
  const folder = await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "Original folder");
  const link = await filesystem.createShortcut({ targetEntryId: folder.id, parentId: FILESYSTEM_ROOT_ID.DOCUMENTS, name: "Folder link" });
  const create = vi.spyOn(filesystem, "createShortcut");
  const resolve = vi.spyOn(filesystem, "resolveShortcut");
  const user = userEvent.setup();
  render(<App api={new FakeDashboardGateway()} filesystemApi={filesystem} />);
  await user.dblClick(within(await screen.findByRole("navigation", { name: FILESYSTEM_COPY.DESKTOP_SHORTCUTS })).getByRole("button", { name: "내 문서" }));
  const explorer = await waitFor(() => desktopWindowByTitle("내 문서"));
  fireEvent.contextMenu(await within(explorer).findByRole("button", { name: "Original folder" }));
  await user.click(screen.getByRole("menuitem", { name: "바로가기 만들기" }));
  const dialog = await screen.findByRole("dialog", { name: "바로가기 만들기" });
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "여기에 만들기" })).toBeEnabled());
  await user.click(within(dialog).getByRole("button", { name: "여기에 만들기" }));
  await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ targetEntryId: folder.id, parentId: FILESYSTEM_ROOT_ID.DESKTOP })));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "바로가기 만들기" })).not.toBeInTheDocument());
  await user.dblClick(within(explorer).getByRole("button", { name: /Folder link/ }));
  await waitFor(() => expect(desktopWindowTitles()).toEqual(["Original folder"]));
  expect(resolve).toHaveBeenCalledWith(link.id);
});

it("opens an existing folder shortcut on mobile without offering creation", async () => {
  const filesystem = new FakeFilesystemGateway();
  const folder = await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "Mobile target");
  filesystem.addFile("Child file.txt", "text/plain", folder.id);
  const link = await filesystem.createShortcut({ targetEntryId: folder.id, parentId: FILESYSTEM_ROOT_ID.DOCUMENTS, name: "Mobile link" });
  const resolve = vi.spyOn(filesystem, "resolveShortcut");
  renderMobile({ filesystem });
  fireEvent.click(await screen.findByRole("button", { name: MOBILE_COPY.MY_DOCUMENTS }));
  fireEvent.click(await screen.findByRole("button", { name: /Mobile link/ }));
  await screen.findByText("Child file.txt");
  expect(resolve).toHaveBeenCalledWith(link.id);
  fireEvent.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
  expect(screen.queryByText("바로가기 만들기")).not.toBeInTheDocument();
});
