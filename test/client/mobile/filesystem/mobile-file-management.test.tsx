import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MobileDirectory } from "@client/components/mobile/filesystem/mobile-directory";
import { MobileRecycleBin } from "@client/components/mobile/filesystem/mobile-recycle-bin";
import { ThumbnailLoadProvider } from "@client/state/filesystem/thumbnail-load-context";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_COPY as COPY } from "@client/content/ko/filesystem/filesystem";
import { MOBILE_FILESYSTEM_COPY as MOBILE_FILES } from "@client/content/ko/mobile/filesystem";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { renderMobile, mobilePreferencesGateway } from "@test/support/mobile/mobile-app-test-helpers";
import { deferred } from "@test/support/widgets/deferred";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
});

it("creates folders, preserves failed rename input and refreshes the current mobile list", async () => {
  const gateway = new FakeFilesystemGateway();
  const entry = gateway.addFile("original.txt", "text/plain");
  const update = vi.spyOn(gateway, "updateEntry").mockRejectedValueOnce(new Error("rename failed"));
  const create = vi.spyOn(gateway, "createDirectory");
  renderMobile({ filesystem: gateway });
  fireEvent.click(await screen.findByRole("button", { name: MOBILE_COPY.MY_DOCUMENTS }));
  await screen.findByText(entry.name);
  fireEvent.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
  fireEvent.click(screen.getByRole("button", { name: COPY.NEW_FOLDER }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "invalid/name" } });
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  await screen.findByRole("alert");
  expect(create).not.toHaveBeenCalled();
  expect(screen.getByRole("textbox")).toHaveValue("invalid/name");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "new folder" } });
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  await screen.findByText("new folder");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
  fireEvent.click(screen.getByRole("button", { name: MOBILE_FILES.SELECT }));
  fireEvent.click(screen.getByRole("checkbox", { name: entry.name }));
  fireEvent.click(screen.getByRole("button", { name: COPY.RENAME }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "renamed.txt" } });
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent("rename failed");
  expect(screen.getByRole("textbox")).toHaveValue("renamed.txt");
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  await screen.findByText("renamed.txt");
  expect(update).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});

it("keeps only failed batch items selected and restores the mobile wallpaper preference", async () => {
  const gateway = new FakeFilesystemGateway();
  const first = gateway.addFile("first.txt", "text/plain");
  const second = gateway.addFile("second.txt", "text/plain");
  const preferences = mobilePreferencesGateway();
  const trash = gateway.trashEntries.bind(gateway);
  vi.spyOn(gateway, "trashEntries").mockImplementation(async () => {
    const result = await trash([first.id]);
    return { ...result, failures: [{ id: second.id, code: "FAILED", message: "partial failure" }] };
  });
  renderMobile({ filesystem: gateway, mobilePreferencesApi: preferences });
  fireEvent.click(await screen.findByRole("button", { name: MOBILE_COPY.MY_DOCUMENTS }));
  await screen.findByText(first.name);
  fireEvent.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
  fireEvent.click(screen.getByRole("button", { name: MOBILE_FILES.SELECT }));
  fireEvent.click(screen.getByRole("button", { name: MOBILE_FILES.SELECT_ALL }));
  expect(screen.getByRole("button", { name: COPY.RENAME })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: COPY.DELETE }));
  expect(screen.getByRole("dialog")).toHaveTextContent(MOBILE_FILES.TRASH_CONFIRM(2));
  fireEvent.click(screen.getByRole("button", { name: COPY.CONFIRM }));
  await screen.findByText(/partial failure/);
  fireEvent.click(screen.getByRole("button", { name: COPY.CLOSE }));
  await waitFor(() => expect(screen.queryByRole("checkbox", { name: first.name })).not.toBeInTheDocument());
  expect(screen.getByRole("checkbox", { name: second.name })).toBeChecked();
  expect(preferences.getPreferences).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: MOBILE_COPY.HOME }));
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: MOBILE_COPY.MY_DOCUMENTS })).toBeInTheDocument();
});

it("excludes the current parent and selected folders as move destinations", async () => {
  const gateway = new FakeFilesystemGateway();
  const folder = await gateway.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "source");
  const target = await gateway.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "target");
  const move = vi.spyOn(gateway, "moveEntries");
  render(<DirectoryHarness gateway={gateway} />, { wrapper: ThumbnailLoadProvider });
  fireEvent.click(await screen.findByRole("button", { name: MOBILE_FILES.SELECT }));
  fireEvent.click(screen.getByRole("checkbox", { name: folder.name }));
  fireEvent.click(screen.getByRole("button", { name: COPY.MOVE }));
  const dialog = screen.getByRole("dialog");
  await within(dialog).findByRole("button", { name: target.name });
  expect(within(dialog).queryByRole("button", { name: folder.name })).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: COPY.MOVE_HERE })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole("button", { name: target.name }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: COPY.MOVE_HERE })).toBeEnabled());
  fireEvent.click(within(dialog).getByRole("button", { name: COPY.MOVE_HERE }));
  await waitFor(() => expect(move).toHaveBeenCalledWith([folder.id], { parentId: target.id }));
});

it("refreshes deletion state after failure, blocks restore and permits manual retry", async () => {
  const gateway = new FakeFilesystemGateway();
  const entry = gateway.addFile("incomplete.txt", "text/plain");
  await gateway.trashEntries([entry.id]);
  const list = gateway.listTrash.bind(gateway);
  let started = false;
  vi.spyOn(gateway, "listTrash").mockImplementation(async () => {
    const page = await list();
    return { ...page, items: page.items.map((item) => ({ ...item, deletionStartedAt: started ? new Date(0).toISOString() : null })) };
  });
  const remove = vi.spyOn(gateway, "permanentlyDeleteEntries").mockImplementationOnce(async () => {
    started = true;
    throw new Error("delete failed");
  });
  render(<TrashHarness gateway={gateway} />, { wrapper: ThumbnailLoadProvider });
  fireEvent.click(await screen.findByRole("button", { name: MOBILE_FILES.SELECT }));
  fireEvent.click(screen.getByRole("checkbox", { name: entry.name }));
  fireEvent.click(screen.getByRole("button", { name: COPY.PERMANENT_DELETE }));
  fireEvent.click(screen.getByRole("button", { name: COPY.CONFIRM }));
  await screen.findByText(COPY.DELETION_INCOMPLETE);
  expect(screen.getByRole("alert")).toHaveTextContent("delete failed");
  fireEvent.click(screen.getByRole("button", { name: COPY.CANCEL }));
  expect(screen.getByRole("button", { name: COPY.RESTORE })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: COPY.PERMANENT_DELETE }));
  fireEvent.click(screen.getByRole("button", { name: COPY.CONFIRM }));
  await screen.findByText(MOBILE_COPY.EMPTY_TRASH);
  expect(remove).toHaveBeenCalledTimes(2);
});

it("restores selected entries with the server's default destination", async () => {
  const gateway = new FakeFilesystemGateway();
  const entry = gateway.addFile("restore.txt", "text/plain");
  await gateway.trashEntries([entry.id]);
  const restore = vi.spyOn(gateway, "restoreEntries");
  render(<TrashHarness gateway={gateway} />, { wrapper: ThumbnailLoadProvider });
  await screen.findByText(entry.name);
  fireEvent.click(screen.getByRole("button", { name: MOBILE_FILES.SELECT }));
  fireEvent.click(screen.getByRole("checkbox", { name: entry.name }));
  fireEvent.click(screen.getByRole("button", { name: COPY.RESTORE }));
  await screen.findByText(MOBILE_COPY.EMPTY_TRASH);
  expect(restore).toHaveBeenCalledWith([entry.id]);
  expect((await gateway.listDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS)).items).toContainEqual(expect.objectContaining({ id: entry.id, name: entry.name }));
});

it("keeps an empty-trash failure visible after refresh and allows retry", async () => {
  const gateway = new FakeFilesystemGateway();
  const entry = gateway.addFile("empty.txt", "text/plain");
  await gateway.trashEntries([entry.id]);
  const empty = vi.spyOn(gateway, "emptyTrash").mockRejectedValueOnce(new Error("empty failed"));
  const list = vi.spyOn(gateway, "listTrash");
  render(<TrashHarness gateway={gateway} />, { wrapper: ThumbnailLoadProvider });
  await screen.findByText(entry.name);
  fireEvent.click(screen.getByRole("button", { name: COPY.EMPTY_RECYCLE_BIN }));
  expect(screen.getByRole("dialog")).toHaveTextContent(MOBILE_FILES.EMPTY_CONFIRM);
  expect(empty).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: COPY.CONFIRM }));
  await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("alert")).toHaveTextContent("empty failed");
  fireEvent.click(screen.getByRole("button", { name: COPY.CONFIRM }));
  await screen.findByText(MOBILE_COPY.EMPTY_TRASH);
  expect(empty).toHaveBeenCalledTimes(2);
});

it("does not apply an old rename after the gateway changes", async () => {
  const first = new FakeFilesystemGateway();
  const entry = first.addFile("old.txt", "text/plain");
  const pending = deferred<FilesystemEntry>();
  vi.spyOn(first, "updateEntry").mockReturnValue(pending.promise);
  const changed = vi.fn();
  const second = new FakeFilesystemGateway();
  second.addFile("new.txt", "text/plain");
  const props = { directoryId: FILESYSTEM_ROOT_ID.DOCUMENTS, title: "Documents", revision: 0,
    menuOpen: true, onCloseMenu: vi.fn(), onSearch: vi.fn(), onRefresh: changed, onChanged: changed,
    onOpenDirectory: vi.fn(), onOpenEntry: vi.fn(), onUpload: vi.fn(), onGuardChange: vi.fn() };
  const view = render(<MobileDirectory {...props} gateway={first} />, { wrapper: ThumbnailLoadProvider });
  await screen.findByText(entry.name);
  fireEvent.click(screen.getByRole("button", { name: MOBILE_FILES.SELECT }));
  fireEvent.click(screen.getByRole("checkbox", { name: entry.name }));
  fireEvent.click(screen.getByRole("button", { name: COPY.RENAME }));
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  expect(first.updateEntry).toHaveBeenCalledTimes(1);
  expect(props.onGuardChange.mock.lastCall?.[0]()).toBe(false);
  view.rerender(<MobileDirectory {...props} gateway={second} />);
  await screen.findByText("new.txt");
  await act(async () => pending.resolve({ ...entry, name: "late.txt" }));
  expect(changed).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

function DirectoryHarness({ gateway }: { readonly gateway: FakeFilesystemGateway }) {
  const [revision, setRevision] = useState(0);
  const [menuOpen, setMenuOpen] = useState(true);
  return <MobileDirectory gateway={gateway} directoryId={FILESYSTEM_ROOT_ID.DOCUMENTS} title="Documents"
    revision={revision} menuOpen={menuOpen} onCloseMenu={() => setMenuOpen(false)}
    onRefresh={() => setRevision((value) => value + 1)} onSearch={vi.fn()} onUpload={vi.fn()}
    onChanged={() => setRevision((value) => value + 1)}
    onGuardChange={vi.fn()} onOpenDirectory={vi.fn()} onOpenEntry={vi.fn()} />;
}

function TrashHarness({ gateway }: { readonly gateway: FakeFilesystemGateway }) {
  const [revision, setRevision] = useState(0);
  const [menuOpen, setMenuOpen] = useState(true);
  return <MobileRecycleBin gateway={gateway} revision={revision} menuOpen={menuOpen}
    onCloseMenu={() => setMenuOpen(false)} onRefresh={() => setRevision((value) => value + 1)}
    onChanged={() => setRevision((value) => value + 1)} onGuardChange={vi.fn()} />;
}
