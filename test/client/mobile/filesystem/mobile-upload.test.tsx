import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useFilesystemUpload } from "@client/hooks/filesystem/use-filesystem-upload";
import { MobileUploadDialog } from "@client/components/mobile/filesystem/manage/mobile-upload-dialog";
import { FILESYSTEM_COPY as COPY } from "@client/content/ko/filesystem/filesystem";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { MOBILE_FILESYSTEM_COPY } from "@client/content/ko/mobile/filesystem";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_UPLOAD_POLICY } from "@client/constants/filesystem/filesystem";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { renderMobile } from "@test/support/mobile/mobile-app-test-helpers";
import { deferred } from "@test/support/widgets/deferred";
import { fileEntry } from "@test/support/filesystem/file-entry";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
});

it("stops pending mobile uploads, blocks navigation and retries only unconfirmed files", async () => {
  const gateway = new FakeFilesystemGateway();
  const pending = deferred<FilesystemFileEntry>();
  const upload = vi.spyOn(gateway, "uploadFile").mockReturnValue(pending.promise);
  renderMobile({ filesystem: gateway });
  fireEvent.click(await screen.findByRole("button", { name: MOBILE_COPY.MY_DOCUMENTS }));
  await screen.findByText(MOBILE_COPY.EMPTY_DIRECTORY);
  fireEvent.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
  fireEvent.click(screen.getByRole("button", { name: COPY.UPLOAD_FILES }));
  const files = Array.from({ length: FILESYSTEM_UPLOAD_POLICY.CONCURRENCY + 1 }, (_, index) => new File(["file"], `${index}.txt`));
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files } });
  await screen.findByRole("dialog", { name: COPY.TRANSFER_TITLE });
  expect(upload).toHaveBeenCalledTimes(FILESYSTEM_UPLOAD_POLICY.CONCURRENCY);
  fireEvent.click(screen.getByRole("button", { name: MOBILE_COPY.HOME }));
  await act(() => new Promise<void>((resolve) => {
    window.addEventListener("popstate", () => resolve(), { once: true });
    history.back();
  }));
  await waitFor(() => expect(history.state.computerRoomMobileDepth).toBe(1));
  expect(screen.getByRole("heading", { name: MOBILE_COPY.MY_DOCUMENTS })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: MOBILE_COPY.MENU })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: COPY.TRANSFER_STOP }));
  expect(screen.getByRole("button", { name: COPY.TRANSFER_STOP })).toBeDisabled();
  await act(async () => pending.resolve(fileEntry("uploaded", "uploaded.txt", "text/plain")));
  expect(upload).toHaveBeenCalledTimes(FILESYSTEM_UPLOAD_POLICY.CONCURRENCY);
  await screen.findByRole("button", { name: COPY.TRANSFER_RETRY });
  upload.mockResolvedValue(fileEntry("last", "last.txt", "text/plain"));
  fireEvent.click(screen.getByRole("button", { name: COPY.TRANSFER_RETRY }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(upload).toHaveBeenCalledTimes(files.length);
  expect(upload.mock.calls.every(([id]) => id === FILESYSTEM_ROOT_ID.DOCUMENTS)).toBe(true);
  expect(upload.mock.calls.map(([, file]) => file.name)).toEqual(files.map((file) => file.name));
});

it("confirms discarding a failed transfer and allows another file selection", async () => {
  const gateway = new FakeFilesystemGateway();
  const upload = vi.spyOn(gateway, "uploadFile").mockRejectedValue(new Error("upload failed"));
  renderMobile({ filesystem: gateway });
  fireEvent.click(await screen.findByRole("button", { name: MOBILE_COPY.MY_DOCUMENTS }));
  await screen.findByText(MOBILE_COPY.EMPTY_DIRECTORY);
  const input = document.querySelector('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [] } });
  expect(upload).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { files: [new File(["x"], "failed.txt")] } });
  await screen.findByText(/upload failed/);
  fireEvent.click(screen.getByRole("button", { name: COPY.CLOSE }));
  expect(screen.getByText(MOBILE_FILESYSTEM_COPY.DISCARD_TRANSFER)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: COPY.CANCEL }));
  expect(screen.getByRole("button", { name: COPY.TRANSFER_RETRY })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: COPY.CLOSE }));
  fireEvent.click(screen.getByRole("button", { name: COPY.CONFIRM }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  upload.mockResolvedValue(fileEntry("new", "new.txt", "text/plain"));
  fireEvent.change(input, { target: { files: [new File(["x"], "new.txt")] } });
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("drops old transfer work when its gateway changes or its screen unmounts", async () => {
  const first = new FakeFilesystemGateway();
  const second = new FakeFilesystemGateway();
  const pending = deferred<FilesystemFileEntry>();
  const upload = vi.spyOn(first, "uploadFile").mockReturnValue(pending.promise);
  const changed = vi.fn();
  const view = render(<TransferHarness gateway={first} onChanged={changed} />);
  fireEvent.click(screen.getByRole("button", { name: COPY.UPLOAD }));
  view.rerender(<TransferHarness gateway={second} onChanged={changed} />);
  await act(async () => pending.resolve(fileEntry("old", "old.txt", "text/plain")));
  expect(changed).not.toHaveBeenCalled();
  expect(upload).toHaveBeenCalledTimes(FILESYSTEM_UPLOAD_POLICY.CONCURRENCY);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const last = deferred<FilesystemFileEntry>();
  const nextUpload = vi.spyOn(second, "uploadFile").mockReturnValue(last.promise);
  fireEvent.click(screen.getByRole("button", { name: COPY.UPLOAD }));
  view.unmount();
  await act(async () => last.reject(new Error("unmounted")));
  expect(changed).not.toHaveBeenCalled();
  expect(nextUpload).toHaveBeenCalledTimes(FILESYSTEM_UPLOAD_POLICY.CONCURRENCY);
});

function TransferHarness({ gateway, onChanged }: { readonly gateway: FakeFilesystemGateway; readonly onChanged: () => void }) {
  const transfer = useFilesystemUpload(gateway, onChanged);
  return <>
    <button type="button" onClick={() => void transfer.upload(
      Array.from({ length: FILESYSTEM_UPLOAD_POLICY.CONCURRENCY + 1 }, (_, index) => ({ kind: "file", name: `${index}.txt`, file: new File(["x"], `${index}.txt`) })),
      FILESYSTEM_ROOT_ID.DOCUMENTS,
    )}>{COPY.UPLOAD}</button>
    {transfer.state.isOpen ? <MobileUploadDialog transfer={transfer} /> : null}
  </>;
}
