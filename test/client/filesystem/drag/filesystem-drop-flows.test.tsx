import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@client/app";
import { CLIENT_INTERFACE_MODE } from "@client/constants/shared/interface-mode";
import { FILESYSTEM_DRAG_SOURCE } from "@client/constants/filesystem/filesystem";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { DESKTOP_DRAG_DATA_TYPE } from "@client/constants/desktop/desktop";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { memoWidget } from "@test/support/widgets/dashboard-fixtures";
import { dragTransfer } from "@test/support/filesystem/drag-transfer";

beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null, "", "/"); });
afterEach(() => vi.restoreAllMocks());

function app(filesystem: FakeFilesystemGateway, api = new FakeDashboardGateway()) {
  render(<App api={api} filesystemApi={filesystem} interfaceMode={CLIENT_INTERFACE_MODE.DESKTOP} />);
}

function frame(title: string): HTMLElement {
  const element = screen.getByText(title, { selector: ".xp-window-frame__title" }).closest<HTMLElement>(".desktop-window");
  if (!element) throw new Error(`Missing window: ${title}`);
  return element;
}

function activeDrag(ids: readonly string[]) {
  return dragTransfer({ ids, primaryId: ids[0]!, source: FILESYSTEM_DRAG_SOURCE.ACTIVE });
}

describe("desktop filesystem drop wiring", () => {
  it("trashes a dragged selection into the open window, refreshes lists, and closes linked programs", async () => {
    const filesystem = new FakeFilesystemGateway();
    const api = new FakeDashboardGateway();
    const widget = memoWidget("00000000-0000-4000-8000-000000000901");
    if (widget.type !== WIDGET_TYPE.MEMO) throw new Error("Expected a memo fixture");
    const saved = { ...widget, file: { ...widget.file!, parentId: FILESYSTEM_ROOT_ID.DESKTOP, name: "Drop memo" } };
    api.savedWidgets = [saved];
    const document = filesystem.addWidgetFile(saved);
    const file = filesystem.addFile("first.txt", "text/plain", FILESYSTEM_ROOT_ID.DESKTOP);
    const second = filesystem.addFile("second.txt", "text/plain", FILESYSTEM_ROOT_ID.DESKTOP);
    const performTrash = filesystem.trashEntries.bind(filesystem);
    const trash = vi.spyOn(filesystem, "trashEntries").mockImplementation(async (ids) => {
      const result = await performTrash(ids);
      if (!ids.includes(document.id)) return result;
      api.savedWidgets = [];
      return { ...result, closedWidgetIds: [widget.id] };
    });
    const move = vi.spyOn(filesystem, "moveEntries");
    app(filesystem, api);
    await waitFor(() => expect(frame("Drop memo")).toBeInTheDocument());
    const user = userEvent.setup();
    await user.dblClick(await screen.findByRole("button", { name: "휴지통" }));
    const recycle = await waitFor(() => frame("휴지통"));
    const empty = await within(recycle).findByText(FILESYSTEM_COPY.EMPTY_TRASH);
    const shortcuts = screen.getByRole("navigation", { name: FILESYSTEM_COPY.DESKTOP_SHORTCUTS });
    const firstIcon = within(shortcuts).getByRole("button", { name: file.name });
    fireEvent.click(firstIcon);
    fireEvent.click(within(shortcuts).getByRole("button", { name: "Drop memo" }), { ctrlKey: true });
    const dataTransfer = dragTransfer();
    fireEvent.dragStart(firstIcon, { dataTransfer });
    fireEvent.dragOver(empty, { dataTransfer });
    fireEvent.drop(empty, { dataTransfer });
    await waitFor(() => expect(trash).toHaveBeenCalledOnce());
    expect(new Set(trash.mock.calls[0]![0])).toEqual(new Set([file.id, document.id]));
    await within(recycle).findByText(file.name);
    await waitFor(() => expect(screen.queryByText("Drop memo", { selector: ".xp-window-frame__title" })).not.toBeInTheDocument());
    expect(within(shortcuts).queryByRole("button", { name: file.name })).not.toBeInTheDocument();

    // A title bar is not a file target and must never fall through to the desktop.
    fireEvent.drop(within(recycle).getByText("휴지통", { selector: "strong" }), { dataTransfer: activeDrag([second.id]) });
    expect(trash).toHaveBeenCalledOnce();
    expect(move).not.toHaveBeenCalled();
    fireEvent.drop(within(recycle).getByText(file.name), { dataTransfer: activeDrag([second.id]) });
    await waitFor(() => expect(trash).toHaveBeenCalledTimes(2));
    await within(recycle).findByText(second.name);
    expect(move).not.toHaveBeenCalled();
  });

  it("prioritizes desktop folders, explorer folders, and breadcrumb targets over their parent", async () => {
    const filesystem = new FakeFilesystemGateway();
    const desktopFolder = await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "Desktop folder");
    const folder = await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "Nested folder");
    const file = filesystem.addFile("file.txt", "text/plain");
    const move = vi.spyOn(filesystem, "moveEntries");
    const restore = vi.spyOn(filesystem, "restoreEntries");
    app(filesystem);
    const user = userEvent.setup();
    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    const explorer = await waitFor(() => frame("내 문서"));
    const source = await within(explorer).findByRole("button", { name: /file.txt/ });
    const dataTransfer = dragTransfer();
    fireEvent.dragStart(source, { dataTransfer });
    const target = screen.getByRole("button", { name: desktopFolder.name });
    fireEvent.drop(target.querySelector("img")!, { dataTransfer });
    await waitFor(() => expect(move).toHaveBeenCalledExactlyOnceWith([file.id], { parentId: desktopFolder.id }));
    const nested = await within(explorer).findByRole("button", { name: folder.name });
    fireEvent.drop(nested.querySelector("span")!, { dataTransfer: activeDrag([file.id]) });
    await waitFor(() => expect(move).toHaveBeenCalledTimes(2));
    expect(move).toHaveBeenLastCalledWith([file.id], { parentId: folder.id });
    const breadcrumb = await within(explorer).findByRole("button", { name: "내 문서" });
    await waitFor(() => expect(within(explorer).getByRole("button", { name: "새 폴더" })).toBeEnabled());
    fireEvent.drop(breadcrumb, { dataTransfer: activeDrag([file.id]) });
    await waitFor(() => expect(move).toHaveBeenCalledTimes(3));
    expect(move).toHaveBeenLastCalledWith([file.id], { parentId: FILESYSTEM_ROOT_ID.DOCUMENTS });
    await filesystem.trashEntry(file.id);
    const refreshedFolder = await within(explorer).findByRole("button", { name: folder.name });
    await waitFor(() => expect(within(explorer).getByRole("button", { name: "새 폴더" })).toBeEnabled());
    fireEvent.drop(refreshedFolder, { dataTransfer: dragTransfer({ ids: [file.id], primaryId: file.id, source: FILESYSTEM_DRAG_SOURCE.TRASH }) });
    await waitFor(() => expect(restore).toHaveBeenCalledExactlyOnceWith([file.id], { parentId: folder.id }));
    expect(move).toHaveBeenCalledTimes(3);
  });

  it("rejects local, malformed, and already-trashed drops and displays a failed mutation without moving anything", async () => {
    const filesystem = new FakeFilesystemGateway();
    const file = filesystem.addFile("file.txt", "text/plain", FILESYSTEM_ROOT_ID.DESKTOP);
    const trash = vi.spyOn(filesystem, "trashEntries");
    const move = vi.spyOn(filesystem, "moveEntries");
    app(filesystem);
    const user = userEvent.setup();
    await user.dblClick(await screen.findByRole("button", { name: "휴지통" }));
    const recycle = await waitFor(() => frame("휴지통"));
    const empty = await within(recycle).findByText(FILESYSTEM_COPY.EMPTY_TRASH);
    fireEvent.drop(empty, { dataTransfer: dragTransfer(undefined, [new File(["test"], "local.txt")]) });
    fireEvent.drop(empty, { dataTransfer: dragTransfer({ ids: [file.id], primaryId: file.id, source: FILESYSTEM_DRAG_SOURCE.TRASH }) });
    expect(within(recycle).getByRole("alert")).toHaveTextContent(FILESYSTEM_COPY.DROP_NOT_ALLOWED);
    const malformed = dragTransfer();
    malformed.setData(DESKTOP_DRAG_DATA_TYPE, "{bad json");
    fireEvent.drop(empty, { dataTransfer: malformed });
    expect(trash).not.toHaveBeenCalled();
    expect(move).not.toHaveBeenCalled();
    trash.mockRejectedValueOnce(new Error("Test failure"));
    fireEvent.drop(empty, { dataTransfer: activeDrag([file.id]) });
    await waitFor(() => expect(within(recycle).getByRole("alert")).toHaveTextContent("Test failure"));
    expect(trash).toHaveBeenCalledOnce();
    expect((await filesystem.listDirectory(FILESYSTEM_ROOT_ID.DESKTOP)).items.map(({ id }) => id)).toContain(file.id);
  });
});
