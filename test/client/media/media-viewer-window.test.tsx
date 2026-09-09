import { useState, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WINDOW_STATE, WINDOW_RESTORE_STATE } from "@/constants/widgets/widget";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import { MediaViewerWindow } from "@client/components/media/media-viewer-window";
import { MEDIA_VIEWER_COPY as COPY } from "@client/content/ko/media/media";
import { XpContextMenuProvider } from "@client/state/context-menu/context-menu-context";
import type { MediaViewerWindowProps } from "@client/types/media/media";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";

vi.mock("react-rnd", () => ({ Rnd: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Viewer({ initial, gateway }: {
  initial: FilesystemFileEntry;
  gateway: MediaViewerWindowProps["gateway"];
}) {
  const [currentFile, onChangeFile] = useState(initial);
  return <XpContextMenuProvider><MediaViewerWindow
    window={{ id: "media-window", currentFile, directoryId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      position: { x: 0, y: 0 }, size: { width: 720, height: 540 },
      windowState: WINDOW_STATE.NORMAL, restoreState: WINDOW_RESTORE_STATE.NORMAL }}
    desktop={{ width: 1024, height: 768 }} gateway={gateway} filesystemRevision={0}
    isActive zIndex={1} onFocus={() => {}} onMinimize={() => {}}
    onToggleMaximize={() => {}} onClose={() => {}} onCommitBounds={() => {}}
    onChangeFile={onChangeFile}
  /></XpContextMenuProvider>;
}

describe("image new tab commands", () => {
  it.each(["owner", "guest"])("uses the current original for toolbar and context menu (%s)", async (access) => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const filesystem = new FakeFilesystemGateway();
    const first = filesystem.addFile("first.png", "image/png");
    const second = filesystem.addFile("second.png", "image/png");
    const gateway = {
      listDirectory: filesystem.listDirectory.bind(filesystem),
      contentUrl: (id: string) => `/${access}/content/${id}`,
      downloadUrl: filesystem.downloadUrl.bind(filesystem),
    };
    render(<Viewer initial={first} gateway={gateway} />);
    await waitFor(() => expect(screen.getByRole("button", { name: COPY.NEXT })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: COPY.ROTATE_RIGHT }));
    const button = screen.getByRole("button", { name: COPY.OPEN_NEW_TAB });
    expect(button).toHaveAttribute("title", COPY.OPEN_NEW_TAB);
    fireEvent.click(button);
    expect(open).toHaveBeenLastCalledWith(gateway.contentUrl(first.id), "_blank", "noopener,noreferrer");
    fireEvent.click(screen.getByRole("button", { name: COPY.NEXT }));
    const image = await screen.findByAltText(second.name);
    fireEvent.contextMenu(image);
    fireEvent.click(await screen.findByRole("menuitem", { name: COPY.OPEN_NEW_TAB }));
    expect(open).toHaveBeenLastCalledWith(gateway.contentUrl(second.id), "_blank", "noopener,noreferrer");
    fireEvent.error(image);
    expect(screen.getByRole("alert")).toHaveTextContent(COPY.LOAD_FAILED);
    fireEvent.click(screen.getByRole("button", { name: COPY.OPEN_NEW_TAB }));
    expect(open).toHaveBeenCalledTimes(3);
    expect(open).toHaveBeenLastCalledWith(gateway.contentUrl(second.id), "_blank", "noopener,noreferrer");
    expect(screen.getByRole("button", { name: COPY.DOWNLOAD })).toBeInTheDocument();
  });

  it("does not offer the command in video controls or context menu", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const gateway = new FakeFilesystemGateway();
    const video = gateway.addFile("video.mp4", "video/mp4");
    const { container } = render(<Viewer initial={video} gateway={gateway} />);
    expect(screen.queryByRole("button", { name: COPY.OPEN_NEW_TAB })).not.toBeInTheDocument();
    fireEvent.contextMenu(container.querySelector("video")!);
    expect(await screen.findByRole("menuitem", { name: COPY.DOWNLOAD_FILE })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: COPY.OPEN_NEW_TAB })).not.toBeInTheDocument();
  });
});
