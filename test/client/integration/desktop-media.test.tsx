import { STORAGE_STATUS_COPY } from "@client/content/ko/storage/storage-status";
import { MEDIA_VIEWER_COPY } from "@client/content/ko/media/media";
import { NOTEPAD_COPY } from "@client/content/ko/filesystem/text/notepad";
import { FILESYSTEM_SORT_COPY } from "@client/content/ko/filesystem/sort";
import { FOLDER_PROPERTIES_COPY } from "@client/content/ko/filesystem/details";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@client/app";
import {
  CHECKLIST_WIDGET_COPY,
  DASHBOARD_COPY,
  MEMO_WIDGET_COPY,
} from "@client/content/ko/widgets/content";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import { ACCESS_LOGOUT_PATH } from "@/constants/platform/auth";
import { CHECKLIST_EVENT_ACTION } from "@/constants/widgets/checklist";
import { MAX_FILE_SIZE_BYTES } from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import { cloneDashboardWidgets } from "@/domain/widgets/widget-data";
import type { SessionInfo } from "@/types/platform/auth";
import type {
  ChecklistItem,
  ChecklistLogEvent,
  ChecklistLogPage,
  DailyChecklistData,
  DashboardWidget,
  CreateWidgetInput,
  MemoData,
  WidgetLayout,
} from "@/types/widgets/widget";
import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
  FilesystemEntry,
  FilesystemFileEntry,
  FilesystemTrashPage,
  FilesystemWidgetEntry,
  MoveFilesystemEntryInput,
  SaveWidgetFileInput,
  UpdateFilesystemEntryInput,
} from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { FilesystemDirectoryDetails } from "@/types/filesystem/directory-details";
import type { FilesystemDownloadManifest } from "@/types/filesystem/download";
import type { StorageStatusSnapshot } from "@/types/storage/storage-status";

vi.mock("react-rnd", () => ({
  Rnd: ({ children }: { readonly children: ReactNode }) => (
    <div data-testid="desktop-window">{children}</div>
  ),
}));
import { SESSION } from "@test/support/desktop/app-test-session";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import {
  checklistWidget,
  desktopWindowByTitle,
  desktopWindowTitles,
  emptyStorageStatusSnapshot,
  memoWidget,
  openStartMenu,
} from "@test/client/support/desktop/app-integration-helpers";

describe("App desktop media", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the same supported image in independent viewer windows", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    filesystem.addFile("photo.png", "image/png");
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    const documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
    const photo = await within(documentsWindow).findByRole("button", {
      name: /photo\.png/,
    });
    await user.dblClick(photo);
    await user.dblClick(photo);

    const title = "photo.png - Windows 사진 및 팩스 뷰어";
    await waitFor(() => {
      expect(desktopWindowTitles().filter((candidate) => candidate === title)).toHaveLength(2);
    });
    expect(
      screen.getAllByRole("button", { name: MEDIA_VIEWER_COPY.ZOOM_IN }),
    ).toHaveLength(2);
  });

  it("shows image thumbnails on the desktop, in folders, and in the recycle bin", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const desktopImage = filesystem.addFile(
      "desktop.png",
      "image/png",
      FILESYSTEM_ROOT_ID.DESKTOP,
    );
    const documentImage = filesystem.addFile("document.png", "image/png");
    const recycledImage = filesystem.addFile("deleted.png", "image/png");
    await filesystem.trashEntry(recycledImage.id);
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    const desktopShortcut = await screen.findByRole("button", {
      name: desktopImage.name,
    });
    await waitFor(() =>
      expect(desktopShortcut.querySelector("img")).toHaveAttribute(
        "src",
        filesystem.thumbnailUrl(desktopImage.id),
      ),
    );

    await user.dblClick(screen.getByRole("button", { name: "내 문서" }));
    const documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
    const documentItem = await within(documentsWindow).findByRole("button", {
      name: new RegExp(documentImage.name),
    });
    await waitFor(() =>
      expect(documentItem.querySelector("img")).toHaveAttribute(
        "src",
        filesystem.thumbnailUrl(documentImage.id),
      ),
    );

    await user.dblClick(screen.getByRole("button", { name: "휴지통" }));
    const recycleWindow = await waitFor(() => desktopWindowByTitle("휴지통"));
    const recycleItem = await within(recycleWindow).findByRole("button", {
      name: new RegExp(recycledImage.name),
    });
    await waitFor(() =>
      expect(recycleItem.querySelector("img")).toHaveAttribute(
        "src",
        filesystem.thumbnailUrl(recycledImage.id),
      ),
    );
  });

  it("navigates from the picture viewer to Windows Media Player and pauses on minimize", async () => {
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    filesystem.addFile("photo.png", "image/png");
    filesystem.addFile("clip.mp4", "video/mp4");
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    const documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
    await user.dblClick(
      await within(documentsWindow).findByRole("button", { name: /photo\.png/ }),
    );
    const pictureTitle = "photo.png - Windows 사진 및 팩스 뷰어";
    const pictureWindow = await waitFor(() => desktopWindowByTitle(pictureTitle));
    await user.click(
      await within(pictureWindow).findByRole("button", {
        name: MEDIA_VIEWER_COPY.NEXT,
      }),
    );

    const playerTitle = "clip.mp4 - Windows Media Player";
    const playerWindow = await waitFor(() => desktopWindowByTitle(playerTitle));
    expect(playerWindow.querySelector("video")).toBeInTheDocument();
    expect(
      within(playerWindow).getByRole("button", { name: MEDIA_VIEWER_COPY.PLAY }),
    ).toBeInTheDocument();
    await user.click(
      within(playerWindow).getByRole("button", { name: DASHBOARD_COPY.MINIMIZE }),
    );
    expect(desktopWindowTitles()).not.toContain(playerTitle);
    expect(pause).toHaveBeenCalled();
  });

  it("offers a download instead of opening an unsupported media type", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    filesystem.addFile("photo.heic", "image/heic");
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    const documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
    await user.dblClick(
      await within(documentsWindow).findByRole("button", { name: /photo\.heic/ }),
    );
    const dialog = screen.getByRole("dialog", {
      name: NOTEPAD_COPY.DOWNLOAD_TITLE,
    });
    await user.click(
      within(dialog).getByRole("button", {
        name: NOTEPAD_COPY.DOWNLOAD,
      }),
    );
    expect(click).toHaveBeenCalledOnce();
    expect(desktopWindowTitles().some((title) => title?.includes("photo.heic"))).toBe(
      false,
    );
  });
});
