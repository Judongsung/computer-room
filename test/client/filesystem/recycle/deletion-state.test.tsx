import { ThumbnailLoadProvider } from "@client/state/filesystem/thumbnail-load-context";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RecycleBinWindow } from "@client/components/filesystem/recycle/recycle-bin-window";
import { MobileRecycleBin } from "@client/components/mobile/filesystem/mobile-recycle-bin";
import { XpContextMenuProvider } from "@client/state/context-menu/context-menu-context";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import { WINDOW_STATE } from "@/constants/widgets/widget";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { fileEntry } from "@test/support/filesystem/file-entry";

it("shows deletion state on desktop and mobile and disables restoration", async () => {
  const gateway = new FakeFilesystemGateway();
  vi.spyOn(gateway, "listTrash").mockResolvedValue({
    items: [{
      entry: fileEntry("blocked", "blocked.txt", "text/plain"),
      deletedAt: new Date(0).toISOString(),
      deletionStartedAt: new Date(1).toISOString(),
      originalParentId: null,
      originalLocation: "Documents",
    }],
    nextOffset: null,
  });
  const view = render(
    <XpContextMenuProvider>
      <RecycleBinWindow
        gateway={gateway}
        desktopCapacity={20}
        filesystemRevision={0}
        onFilesystemChanged={vi.fn()}
        onWidgetsClosed={vi.fn()}
        window={{ id: SYSTEM_APP_ID.RECYCLE_BIN, isOpen: true, position: { x: 0, y: 0 }, size: { width: 600, height: 400 },
          windowState: WINDOW_STATE.NORMAL, restoreState: WINDOW_STATE.NORMAL }}
        desktop={{ width: 1024, height: 768 }}
        isActive zIndex={1}
        onFocus={vi.fn()} onMinimize={vi.fn()} onToggleMaximize={vi.fn()}
        onClose={vi.fn()} onCommitBounds={vi.fn()}
      />
    </XpContextMenuProvider>,
    { wrapper: ThumbnailLoadProvider },
  );
  await screen.findByText(FILESYSTEM_COPY.DELETION_INCOMPLETE);
  const row = screen.getByRole("button", { name: /blocked.txt/ });
  fireEvent.click(row);
  expect(row).toHaveAttribute("draggable", "false");
  expect(screen.getByRole("button", { name: FILESYSTEM_COPY.RESTORE })).toBeDisabled();
  fireEvent.contextMenu(row);
  await waitFor(() => expect(screen.getByRole("menuitem", { name: FILESYSTEM_COPY.RESTORE })).toHaveAttribute("aria-disabled", "true"));
  view.unmount();
  render(<MobileRecycleBin gateway={gateway} revision={0} />, { wrapper: ThumbnailLoadProvider });
  await screen.findByText(FILESYSTEM_COPY.DELETION_INCOMPLETE);
});
