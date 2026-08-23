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
import { App } from "../../src/client/app";
import {
  CHECKLIST_WIDGET_COPY,
  DASHBOARD_COPY,
  MEMO_WIDGET_COPY,
} from "../../src/client/constants/content";
import type { DashboardGateway } from "../../src/client/types/api";
import type { FilesystemGateway } from "../../src/client/types/filesystem";
import { FILESYSTEM_COPY } from "../../src/client/constants/filesystem";
import { MEDIA_VIEWER_COPY } from "../../src/client/constants/media";
import { ACCESS_LOGOUT_PATH } from "../../src/constants/auth";
import { CHECKLIST_EVENT_ACTION } from "../../src/constants/checklist";
import { MAX_FILE_SIZE_BYTES } from "../../src/constants/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "../../src/constants/filesystem";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "../../src/constants/widget";
import { cloneDashboardWidgets } from "../../src/domain/widget-layout";
import type { SessionInfo } from "../../src/types/auth";
import type {
  ChecklistItem,
  ChecklistLogEvent,
  ChecklistLogPage,
  DailyChecklistData,
  DashboardWidget,
  CreateWidgetInput,
  MemoData,
  WidgetLayout,
} from "../../src/types/widget";
import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemEntry,
  FilesystemFileEntry,
  FilesystemTrashPage,
  FilesystemWidgetEntry,
  MoveFilesystemEntryInput,
  SaveWidgetFileInput,
  UpdateFilesystemEntryInput,
} from "../../src/types/filesystem";

vi.mock("react-rnd", () => ({
  Rnd: ({ children }: { readonly children: ReactNode }) => (
    <div data-testid="desktop-window">{children}</div>
  ),
}));

const SESSION: SessionInfo = {
  email: "owner@example.com",
  logoutUrl: ACCESS_LOGOUT_PATH,
  filePolicy: { maxUploadSizeBytes: MAX_FILE_SIZE_BYTES },
};

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("adds and auto-saves a memo from the start menu", async () => {
    const api = new FakeDashboardGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);

    expect(
      await screen.findByText(DASHBOARD_COPY.EMPTY_DESKTOP),
    ).toBeInTheDocument();
    await openStartMenu(user);
    expect(screen.getByText(SESSION.email)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: new RegExp(DASHBOARD_COPY.POWER) }),
    ).toHaveAttribute("href", ACCESS_LOGOUT_PATH);

    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.ADD_MEMO_WIDGET }),
    );
    expect(screen.getByText(MEMO_WIDGET_COPY.EMPTY_CONTENT)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DASHBOARD_COPY.CLOSE }),
    ).toBeEnabled();
    await waitFor(() => expect(api.savedWidgets).toHaveLength(1));
    expect(api.savedWidgets[0]).toMatchObject({
      position: { x: 32, y: 32 },
      windowState: WINDOW_STATE.NORMAL,
      restoreState: WINDOW_RESTORE_STATE.NORMAL,
      stackOrder: 0,
    });
  });

  it("closes the start menu with Escape and a desktop click", async () => {
    const api = new FakeDashboardGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);

    await openStartMenu(user);
    expect(screen.getByLabelText(DASHBOARD_COPY.START_MENU)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByLabelText(DASHBOARD_COPY.START_MENU),
    ).not.toBeInTheDocument();

    await openStartMenu(user);
    await user.click(
      screen.getByRole("main", { name: DASHBOARD_COPY.DESKTOP }),
    );
    expect(
      screen.queryByLabelText(DASHBOARD_COPY.START_MENU),
    ).not.toBeInTheDocument();
  });

  it("maximizes, minimizes, and restores a window from the taskbar", async () => {
    const api = new FakeDashboardGateway();
    api.savedWidgets = [memoWidget("00000000-0000-4000-8000-000000000301")];
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);

    await screen.findByText(MEMO_WIDGET_COPY.EMPTY_CONTENT);
    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.MAXIMIZE }),
    );
    expect(
      screen.getByRole("button", { name: DASHBOARD_COPY.RESTORE }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.MINIMIZE }),
    );
    expect(
      screen.queryByText(MEMO_WIDGET_COPY.EMPTY_CONTENT),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: MEMO_WIDGET_COPY.TITLE }),
    );
    expect(
      screen.getByRole("button", { name: DASHBOARD_COPY.RESTORE }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.savedWidgets[0]?.windowState).toBe(WINDOW_STATE.MAXIMIZED),
    );
  });

  it("keeps the taskbar program order while windows gain focus", async () => {
    const api = new FakeDashboardGateway();
    api.savedWidgets = [
      memoWidget("00000000-0000-4000-8000-000000000301"),
      checklistWidget("00000000-0000-4000-8000-000000000302", 1),
    ];
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);

    const taskbar = await screen.findByRole("contentinfo", {
      name: DASHBOARD_COPY.TASKBAR,
    });
    await waitFor(() =>
      expect(within(taskbar).getAllByRole("button")).toHaveLength(3),
    );
    const programLabels = (): string[] =>
      within(taskbar)
        .getAllByRole("button")
        .slice(1)
        .map((button) => button.textContent?.trim() ?? "");

    expect(programLabels()).toEqual([
      MEMO_WIDGET_COPY.TITLE,
      CHECKLIST_WIDGET_COPY.TITLE,
    ]);
    await user.click(
      within(taskbar).getByRole("button", { name: MEMO_WIDGET_COPY.TITLE }),
    );
    expect(programLabels()).toEqual([
      MEMO_WIDGET_COPY.TITLE,
      CHECKLIST_WIDGET_COPY.TITLE,
    ]);
    await user.click(
      within(taskbar).getByRole("button", {
        name: CHECKLIST_WIDGET_COPY.TITLE,
      }),
    );
    expect(programLabels()).toEqual([
      MEMO_WIDGET_COPY.TITLE,
      CHECKLIST_WIDGET_COPY.TITLE,
    ]);
  });

  it("keeps an inactive window mounted in place during its first interaction", async () => {
    const api = new FakeDashboardGateway();
    api.savedWidgets = [
      memoWidget("00000000-0000-4000-8000-000000000301"),
      checklistWidget("00000000-0000-4000-8000-000000000302", 1),
    ];
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);

    await screen.findByText(MEMO_WIDGET_COPY.EMPTY_CONTENT);
    const inactiveMemoWindow = screen.getAllByTestId("desktop-window")[0]!;
    const editButton = within(inactiveMemoWindow).getByRole("button", {
      name: MEMO_WIDGET_COPY.EDIT,
    });

    fireEvent.mouseDown(editButton);
    expect(desktopWindowTitles()).toEqual([
      MEMO_WIDGET_COPY.TITLE,
      CHECKLIST_WIDGET_COPY.TITLE,
    ]);
    fireEvent.mouseUp(editButton);
    fireEvent.click(editButton);
    expect(
      screen.getByRole("textbox", { name: MEMO_WIDGET_COPY.EDITOR_LABEL }),
    ).toBeInTheDocument();
  });

  it("opens each desktop system app as a single taskbar window", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    const documentsShortcut = await screen.findByRole("button", { name: "내 문서" });
    await user.click(documentsShortcut);
    expect(documentsShortcut).toHaveAttribute("aria-pressed", "true");
    await user.dblClick(documentsShortcut);
    expect(await screen.findByText(FILESYSTEM_COPY.EMPTY_DIRECTORY)).toBeInTheDocument();
    expect(desktopWindowTitles().filter((title) => title === "내 문서")).toHaveLength(1);

    await user.dblClick(documentsShortcut);
    expect(desktopWindowTitles().filter((title) => title === "내 문서")).toHaveLength(1);
    const taskbar = screen.getByRole("contentinfo", { name: DASHBOARD_COPY.TASKBAR });
    expect(within(taskbar).getAllByRole("button", { name: "내 문서" })).toHaveLength(1);
  });

  it("keeps a desktop folder selected and opens other folders in independent windows", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "사진");
    await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "음악");
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    const documentsShortcut = await screen.findByRole("button", {
      name: "내 문서",
    });
    const picturesShortcut = await screen.findByRole("button", { name: "사진" });
    await user.dblClick(picturesShortcut);

    expect(picturesShortcut).toHaveAttribute("aria-pressed", "true");
    expect(documentsShortcut).toHaveAttribute("aria-pressed", "false");
    expect(desktopWindowTitles()).toContain("사진");

    await user.dblClick(screen.getByRole("button", { name: "음악" }));

    await waitFor(() => {
      expect(desktopWindowTitles()).toEqual(
        expect.arrayContaining(["사진", "음악"]),
      );
    });
    const taskbar = screen.getByRole("contentinfo", {
      name: DASHBOARD_COPY.TASKBAR,
    });
    expect(within(taskbar).getByRole("button", { name: "사진" })).toBeInTheDocument();
    expect(within(taskbar).getByRole("button", { name: "음악" })).toBeInTheDocument();
  });

  it("opens the same supported image in independent viewer windows", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    filesystem.addFile("photo.png", "image/png");
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    const documentsWindow = desktopWindowByTitle("내 문서");
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
    const documentsWindow = desktopWindowByTitle("내 문서");
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
    const recycleWindow = desktopWindowByTitle("휴지통");
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
    const documentsWindow = desktopWindowByTitle("내 문서");
    await user.dblClick(
      await within(documentsWindow).findByRole("button", { name: /photo\.png/ }),
    );
    const pictureTitle = "photo.png - Windows 사진 및 팩스 뷰어";
    const pictureWindow = desktopWindowByTitle(pictureTitle);
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
    const documentsWindow = desktopWindowByTitle("내 문서");
    await user.dblClick(
      await within(documentsWindow).findByRole("button", { name: /photo\.heic/ }),
    );
    const dialog = screen.getByRole("dialog", {
      name: MEDIA_VIEWER_COPY.UNSUPPORTED_TITLE,
    });
    await user.click(
      within(dialog).getByRole("button", {
        name: MEDIA_VIEWER_COPY.DOWNLOAD_FILE,
      }),
    );
    expect(click).toHaveBeenCalledOnce();
    expect(desktopWindowTitles().some((title) => title?.includes("photo.heic"))).toBe(
      false,
    );
  });

  it("minimizes, restores, maximizes, and closes a system app", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    let documentsWindow = desktopWindowByTitle("내 문서");
    await user.click(
      within(documentsWindow).getByRole("button", {
        name: DASHBOARD_COPY.MINIMIZE,
      }),
    );
    expect(desktopWindowTitles()).not.toContain("내 문서");

    const taskbar = screen.getByRole("contentinfo", {
      name: DASHBOARD_COPY.TASKBAR,
    });
    await user.click(within(taskbar).getByRole("button", { name: "내 문서" }));
    documentsWindow = desktopWindowByTitle("내 문서");
    await user.click(
      within(documentsWindow).getByRole("button", {
        name: DASHBOARD_COPY.MAXIMIZE,
      }),
    );
    expect(
      within(documentsWindow).getByRole("button", {
        name: DASHBOARD_COPY.RESTORE,
      }),
    ).toBeInTheDocument();
    await user.click(
      within(documentsWindow).getByRole("button", {
        name: DASHBOARD_COPY.CLOSE,
      }),
    );

    expect(desktopWindowTitles()).not.toContain("내 문서");
    expect(
      within(taskbar).queryByRole("button", { name: "내 문서" }),
    ).not.toBeInTheDocument();
  });

  it("creates a widget from My Computer", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 컴퓨터" }));
    const computerWindow = desktopWindowByTitle("내 컴퓨터");
    await user.dblClick(within(computerWindow).getByRole("button", { name: MEMO_WIDGET_COPY.TITLE }));
    expect(await screen.findByText(MEMO_WIDGET_COPY.EMPTY_CONTENT)).toBeInTheDocument();
    await waitFor(() => expect(api.savedWidgets).toHaveLength(1));
  });

  it("saves an unsaved widget as a D1 file and closes it without a second prompt", async () => {
    const api = new FakeDashboardGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);

    await addWidget(user, DASHBOARD_COPY.ADD_MEMO_WIDGET);
    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.SAVE_AS_FILE }),
    );
    const saveDialog = screen.getByRole("dialog", {
      name: FILESYSTEM_COPY.SAVE_WIDGET_TITLE,
    });
    const nameInput = within(saveDialog).getByRole("textbox", {
      name: FILESYSTEM_COPY.FILE_NAME,
    });
    await user.clear(nameInput);
    await user.type(nameInput, "나의 메모");
    await user.click(
      within(saveDialog).getByRole("button", {
        name: FILESYSTEM_COPY.SAVE_HERE,
      }),
    );

    await waitFor(() => expect(desktopWindowTitles()).toContain("나의 메모"));
    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.CLOSE }),
    );
    await waitFor(() =>
      expect(desktopWindowTitles()).not.toContain("나의 메모"),
    );
    expect(
      screen.queryByRole("dialog", {
        name: FILESYSTEM_COPY.UNSAVED_CLOSE_TITLE,
      }),
    ).not.toBeInTheDocument();
  });

  it("updates an open widget title when its file is renamed in My Documents", async () => {
    const api = new FakeDashboardGateway();
    const widget = memoWidget("00000000-0000-4000-8000-000000000401");
    api.savedWidgets = [widget];
    const filesystem = new FakeFilesystemGateway();
    filesystem.addWidgetFile(widget);
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    const documentsWindow = desktopWindowByTitle("내 문서");
    await user.click(
      await within(documentsWindow).findByRole("button", {
        name: MEMO_WIDGET_COPY.TITLE,
      }),
    );
    await user.click(
      within(documentsWindow).getByRole("button", {
        name: FILESYSTEM_COPY.RENAME,
      }),
    );
    const renameDialog = screen.getByRole("dialog", {
      name: FILESYSTEM_COPY.RENAME_TITLE,
    });
    const renameInput = within(renameDialog).getByRole("textbox");
    await user.clear(renameInput);
    await user.type(renameInput, "이름 바꾼 메모");
    await user.click(
      within(renameDialog).getByRole("button", {
        name: FILESYSTEM_COPY.CONFIRM,
      }),
    );

    await waitFor(() =>
      expect(desktopWindowTitles()).toContain("이름 바꾼 메모"),
    );
    const taskbar = screen.getByRole("contentinfo", {
      name: DASHBOARD_COPY.TASKBAR,
    });
    expect(
      within(taskbar).getByRole("button", { name: "이름 바꾼 메모" }),
    ).toBeInTheDocument();
  });

  it("creates a folder from My Documents", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    const documentsWindow = desktopWindowByTitle("내 문서");
    await user.click(within(documentsWindow).getByRole("button", { name: FILESYSTEM_COPY.NEW_FOLDER }));
    const dialog = screen.getByRole("dialog", { name: FILESYSTEM_COPY.CREATE_FOLDER_TITLE });
    await user.type(within(dialog).getByRole("textbox"), "사진");
    await user.click(within(dialog).getByRole("button", { name: FILESYSTEM_COPY.CONFIRM }));
    expect(await within(documentsWindow).findByText("사진")).toBeInTheDocument();
  });

  it("opens shortcuts with Enter and synchronizes My Documents with Recycle Bin", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    const documentsShortcut = await screen.findByRole("button", {
      name: "내 문서",
    });
    documentsShortcut.focus();
    await user.keyboard("{Enter}");
    const documentsWindow = desktopWindowByTitle("내 문서");

    const recycleBinShortcut = screen.getByRole("button", { name: "휴지통" });
    recycleBinShortcut.focus();
    await user.keyboard("{Enter}");
    const recycleBinWindow = desktopWindowByTitle("휴지통");

    await user.click(
      within(documentsWindow).getByRole("button", {
        name: FILESYSTEM_COPY.NEW_FOLDER,
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: FILESYSTEM_COPY.CREATE_FOLDER_TITLE,
    });
    await user.type(within(dialog).getByRole("textbox"), "사진");
    await user.click(
      within(dialog).getByRole("button", { name: FILESYSTEM_COPY.CONFIRM }),
    );
    await user.click(
      await within(documentsWindow).findByRole("button", { name: "사진" }),
    );
    await user.click(
      within(documentsWindow).getByRole("button", {
        name: FILESYSTEM_COPY.DELETE,
      }),
    );

    await user.click(
      await within(recycleBinWindow).findByRole("button", { name: /사진/ }),
    );
    await user.click(
      within(recycleBinWindow).getByRole("button", {
        name: FILESYSTEM_COPY.RESTORE,
      }),
    );
    expect(
      await within(documentsWindow).findByRole("button", { name: "사진" }),
    ).toBeInTheDocument();
    expect(
      within(recycleBinWindow).getByText(FILESYSTEM_COPY.EMPTY_TRASH),
    ).toBeInTheDocument();
  });

  it("confirms permanent deletion and emptying the Recycle Bin", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    const documentsWindow = desktopWindowByTitle("내 문서");
    await user.click(
      within(documentsWindow).getByRole("button", {
        name: FILESYSTEM_COPY.NEW_FOLDER,
      }),
    );
    const nameDialog = screen.getByRole("dialog", {
      name: FILESYSTEM_COPY.CREATE_FOLDER_TITLE,
    });
    await user.type(within(nameDialog).getByRole("textbox"), "삭제할 폴더");
    await user.click(
      within(nameDialog).getByRole("button", {
        name: FILESYSTEM_COPY.CONFIRM,
      }),
    );
    await user.click(
      await within(documentsWindow).findByRole("button", {
        name: "삭제할 폴더",
      }),
    );
    await user.click(
      within(documentsWindow).getByRole("button", {
        name: FILESYSTEM_COPY.DELETE,
      }),
    );

    await user.dblClick(screen.getByRole("button", { name: "휴지통" }));
    const recycleBinWindow = desktopWindowByTitle("휴지통");
    await user.click(
      await within(recycleBinWindow).findByRole("button", {
        name: /삭제할 폴더/,
      }),
    );
    await user.click(
      within(recycleBinWindow).getByRole("button", {
        name: FILESYSTEM_COPY.PERMANENT_DELETE,
      }),
    );
    const deleteDialog = screen.getByRole("dialog", {
      name: FILESYSTEM_COPY.PERMANENT_DELETE,
    });
    expect(deleteDialog).toHaveTextContent(
      FILESYSTEM_COPY.PERMANENT_DELETE_CONFIRM,
    );
    await user.click(
      within(deleteDialog).getByRole("button", {
        name: FILESYSTEM_COPY.CANCEL,
      }),
    );

    await user.click(
      within(recycleBinWindow).getByRole("button", {
        name: FILESYSTEM_COPY.EMPTY_RECYCLE_BIN,
      }),
    );
    const emptyDialog = screen.getByRole("dialog", {
      name: FILESYSTEM_COPY.EMPTY_RECYCLE_BIN,
    });
    expect(emptyDialog).toHaveTextContent(
      FILESYSTEM_COPY.EMPTY_RECYCLE_BIN_CONFIRM,
    );
    await user.click(
      within(emptyDialog).getByRole("button", {
        name: FILESYSTEM_COPY.CONFIRM,
      }),
    );
    expect(
      await within(recycleBinWindow).findByText(FILESYSTEM_COPY.EMPTY_TRASH),
    ).toBeInTheDocument();
  });

  it("serializes auto-saves and sends only the latest queued window state", async () => {
    const api = new FakeDashboardGateway();
    api.savedWidgets = [
      memoWidget("00000000-0000-4000-8000-000000000301"),
      checklistWidget("00000000-0000-4000-8000-000000000302", 1),
    ];
    const releaseFirstSave = api.blockNextLayoutSave();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);

    await screen.findByText(MEMO_WIDGET_COPY.EMPTY_CONTENT);
    await user.click(
      screen.getByRole("button", { name: MEMO_WIDGET_COPY.TITLE }),
    );
    await waitFor(() => expect(api.layoutSaveCalls).toHaveLength(1));

    const memoWindow = desktopWindowByTitle(MEMO_WIDGET_COPY.TITLE);
    await user.click(
      within(memoWindow).getByRole("button", {
        name: DASHBOARD_COPY.MAXIMIZE,
      }),
    );
    await user.click(
      within(memoWindow).getByRole("button", {
        name: DASHBOARD_COPY.MINIMIZE,
      }),
    );
    releaseFirstSave();

    await waitFor(() => expect(api.layoutSaveCalls).toHaveLength(2));
    const latestMemo = api.layoutSaveCalls[1]?.find(
      (widget) => widget.type === WIDGET_TYPE.MEMO,
    );
    expect(latestMemo).toMatchObject({
      windowState: WINDOW_STATE.MINIMIZED,
      restoreState: WINDOW_RESTORE_STATE.MAXIMIZED,
    });
  });

  it("keeps local windows after an auto-save failure and retries", async () => {
    const api = new FakeDashboardGateway();
    api.layoutSaveFailures = 1;
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);

    await addWidget(user, DASHBOARD_COPY.ADD_MEMO_WIDGET);
    expect(screen.getByText(MEMO_WIDGET_COPY.EMPTY_CONTENT)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.MAXIMIZE }),
    );
    expect(await screen.findByText("테스트 저장 실패")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.RETRY }),
    );
    await waitFor(() => expect(api.savedWidgets).toHaveLength(1));
    expect(
      screen.queryByText("테스트 저장 실패"),
    ).not.toBeInTheDocument();
  });

  it("edits and renders a memo with GFM markdown", async () => {
    const api = new FakeDashboardGateway();
    const user = userEvent.setup();
    const markdown =
      "# 오늘\n\n**중요**\n다음 줄\n\n~~완료~~\n\n- [x] 확인\n\n<script>alert('x')</script>";
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);
    await addWidget(user, DASHBOARD_COPY.ADD_MEMO_WIDGET);
    await waitFor(() => expect(api.savedWidgets).toHaveLength(1));

    await user.click(
      screen.getByRole("button", { name: MEMO_WIDGET_COPY.EDIT }),
    );
    const writeTab = screen.getByRole("tab", { name: MEMO_WIDGET_COPY.WRITE });
    const previewTab = screen.getByRole("tab", {
      name: MEMO_WIDGET_COPY.PREVIEW,
    });
    writeTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(previewTab).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    const editor = screen.getByRole("textbox", {
      name: MEMO_WIDGET_COPY.EDITOR_LABEL,
    });
    await user.click(editor);
    await user.paste(markdown);
    await user.click(previewTab);
    expect(screen.getByRole("heading", { name: "오늘" })).toBeInTheDocument();
    expect(screen.getByText("중요").tagName).toBe("STRONG");
    expect(screen.getByText("완료").tagName).toBe("DEL");
    const markdownContent = document.querySelector(".markdown-content");
    expect(markdownContent?.querySelectorAll("br")).toHaveLength(1);
    expect(markdownContent?.querySelector("script")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: MEMO_WIDGET_COPY.SAVE }),
    );
    await waitFor(() =>
      expect(
        api.savedWidgets[0]?.type === WIDGET_TYPE.MEMO
          ? api.savedWidgets[0].data.markdown
          : null,
      ).toBe(markdown),
    );
  });

  it("edits checklist items only in edit state and opens the event log", async () => {
    const api = new FakeDashboardGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);
    await addWidget(user, DASHBOARD_COPY.ADD_CHECKLIST_WIDGET);
    await waitFor(() => expect(api.savedWidgets).toHaveLength(1));

    expect(
      screen.queryByRole("textbox", {
        name: CHECKLIST_WIDGET_COPY.NEW_ITEM_PLACEHOLDER,
      }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: CHECKLIST_WIDGET_COPY.EDIT }),
    );
    await user.type(
      screen.getByRole("textbox", {
        name: CHECKLIST_WIDGET_COPY.NEW_ITEM_PLACEHOLDER,
      }),
      "물 마시기",
    );
    await user.click(
      screen.getByRole("button", { name: CHECKLIST_WIDGET_COPY.ADD_ITEM }),
    );
    const checkbox = await screen.findByRole("checkbox", { name: "물 마시기" });

    await user.click(
      screen.getByRole("button", { name: CHECKLIST_WIDGET_COPY.EDIT_ITEM }),
    );
    const itemEditor = screen.getByRole("textbox", {
      name: CHECKLIST_WIDGET_COPY.EDIT_ITEM,
    });
    await user.clear(itemEditor);
    await user.type(itemEditor, "물 두 잔 마시기");
    await user.click(
      screen.getByRole("button", { name: CHECKLIST_WIDGET_COPY.SAVE_ITEM }),
    );
    const renamedCheckbox = await screen.findByRole("checkbox", {
      name: "물 두 잔 마시기",
    });
    expect(checkbox).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: CHECKLIST_WIDGET_COPY.FINISH_EDITING,
      }),
    );
    expect(
      screen.queryByRole("button", { name: CHECKLIST_WIDGET_COPY.EDIT_ITEM }),
    ).not.toBeInTheDocument();
    await user.click(renamedCheckbox);
    await waitFor(() =>
      expect(screen.getByText("물 두 잔 마시기").tagName).toBe("DEL"),
    );

    await user.click(
      screen.getByRole("button", { name: CHECKLIST_WIDGET_COPY.DETAILS }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(CHECKLIST_WIDGET_COPY.ADDED)).toBeInTheDocument();
    expect(screen.getByText(CHECKLIST_WIDGET_COPY.RENAMED)).toBeInTheDocument();
    expect(screen.getByText("물 마시기 → 물 두 잔 마시기")).toBeInTheDocument();
    expect(screen.getByText(CHECKLIST_WIDGET_COPY.CHECKED)).toBeInTheDocument();
  });
});

class FakeDashboardGateway implements DashboardGateway {
  savedWidgets: DashboardWidget[] = [];
  layoutSaveFailures = 0;
  readonly layoutSaveCalls: WidgetLayout[][] = [];
  readonly checklistLabels = new Map<string, string>();
  readonly checklistLogs: ChecklistLogEvent[] = [];
  private nextChecklistItem = 1;
  private nextLayoutSaveGate: Promise<void> | null = null;
  private nextWidget = 1;

  async getSession(): Promise<SessionInfo> {
    return SESSION;
  }

  async listWidgets(): Promise<DashboardWidget[]> {
    return cloneDashboardWidgets(this.savedWidgets);
  }

  async replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<DashboardWidget[]> {
    this.layoutSaveCalls.push(
      widgets.map((widget) => ({
        ...widget,
        position: { ...widget.position },
        size: { ...widget.size },
      })),
    );
    if (this.nextLayoutSaveGate) {
      const gate = this.nextLayoutSaveGate;
      this.nextLayoutSaveGate = null;
      await gate;
    }
    if (this.layoutSaveFailures > 0) {
      this.layoutSaveFailures -= 1;
      throw new Error("테스트 저장 실패");
    }
    const existingById = new Map(
      this.savedWidgets.map((widget) => [widget.id, widget] as const),
    );
    this.savedWidgets = widgets.map((layout): DashboardWidget => {
      const existing = existingById.get(layout.id);
      if (existing?.type === layout.type) {
        return { ...layout, data: existing.data } as DashboardWidget;
      }
      return layout.type === WIDGET_TYPE.MEMO
        ? {
            ...layout,
            type: WIDGET_TYPE.MEMO,
            file: null,
            data: { markdown: "", updatedAt: null },
          }
        : {
            ...layout,
            type: WIDGET_TYPE.DAILY_CHECKLIST,
            file: null,
            data: {
              businessDate: "2026-08-20",
              nextResetAt: "2026-08-20T15:00:00.000Z",
              items: [],
            },
          };
    });
    return cloneDashboardWidgets(this.savedWidgets);
  }

  async createWidget(input: CreateWidgetInput): Promise<DashboardWidget> {
    const id = `00000000-0000-4000-8000-${String(this.nextWidget).padStart(12, "0")}`;
    this.nextWidget += 1;
    const layout: WidgetLayout = {
      id,
      type: input.type,
      position: input.position,
      size: input.size,
      windowState: WINDOW_STATE.NORMAL,
      restoreState: WINDOW_RESTORE_STATE.NORMAL,
      stackOrder: this.savedWidgets.length,
    };
    const widget: DashboardWidget =
      input.type === WIDGET_TYPE.MEMO
        ? {
            ...layout,
            type: WIDGET_TYPE.MEMO,
            file: null,
            data: { markdown: "", updatedAt: null },
          }
        : {
            ...layout,
            type: WIDGET_TYPE.DAILY_CHECKLIST,
            file: null,
            data: {
              businessDate: "2026-08-20",
              nextResetAt: "2026-08-20T15:00:00.000Z",
              items: [],
            },
          };
    this.savedWidgets.push(widget);
    return structuredClone(widget);
  }

  async saveWidgetFile(
    widgetId: string,
    input: SaveWidgetFileInput,
  ): Promise<{ widget: DashboardWidget; entry: FilesystemWidgetEntry }> {
    const widget = this.savedWidgets.find((candidate) => candidate.id === widgetId);
    if (!widget) throw new Error("Widget not found");
    const entry: FilesystemWidgetEntry = {
      id: `widget-file-${widgetId}`,
      parentId: input.parentId,
      kind: FILESYSTEM_ENTRY_KIND.WIDGET,
      name: input.name,
      widgetId,
      widgetType: widget.type,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
      desktopOrder: null,
    };
    const saved = { ...widget, file: { entryId: entry.id, parentId: input.parentId, name: input.name } };
    this.savedWidgets = this.savedWidgets.map((candidate) =>
      candidate.id === widgetId ? saved : candidate,
    );
    return { widget: saved, entry };
  }

  async openWidget(widgetId: string): Promise<DashboardWidget> {
    const widget = this.savedWidgets.find((candidate) => candidate.id === widgetId);
    if (!widget) throw new Error("Widget not found");
    return structuredClone(widget);
  }

  async closeWidget(_widgetId: string): Promise<void> {}

  async discardWidget(widgetId: string): Promise<void> {
    this.savedWidgets = this.savedWidgets.filter((widget) => widget.id !== widgetId);
  }

  async updateMemo(widgetId: string, markdown: string): Promise<MemoData> {
    const data = { markdown, updatedAt: "2026-08-20T01:00:00.000Z" };
    this.savedWidgets = this.savedWidgets.map((widget) =>
      widget.id === widgetId && widget.type === WIDGET_TYPE.MEMO
        ? { ...widget, data }
        : widget,
    );
    return data;
  }

  async getChecklist(widgetId: string): Promise<DailyChecklistData> {
    const widget = this.savedWidgets.find(
      (candidate) =>
        candidate.id === widgetId &&
        candidate.type === WIDGET_TYPE.DAILY_CHECKLIST,
    );
    if (!widget || widget.type !== WIDGET_TYPE.DAILY_CHECKLIST) {
      throw new Error("Checklist not found");
    }
    return widget.data;
  }

  async addChecklistItem(
    _widgetId: string,
    label: string,
  ): Promise<ChecklistItem> {
    const id = `00000000-0000-4000-8000-${String(this.nextChecklistItem).padStart(12, "0")}`;
    this.nextChecklistItem += 1;
    this.checklistLabels.set(id, label);
    this.addLog(id, label, null, CHECKLIST_EVENT_ACTION.ADDED);
    return { id, label, checked: false };
  }

  async updateChecklistItem(
    _widgetId: string,
    itemId: string,
    label: string,
  ): Promise<ChecklistItem> {
    const previousItemLabel = this.checklistLabels.get(itemId) ?? null;
    this.checklistLabels.set(itemId, label);
    this.addLog(
      itemId,
      label,
      previousItemLabel,
      CHECKLIST_EVENT_ACTION.RENAMED,
    );
    return { id: itemId, label, checked: false };
  }

  async deleteChecklistItem(_widgetId: string, itemId: string): Promise<void> {
    const itemLabel = this.checklistLabels.get(itemId) ?? "항목";
    this.checklistLabels.delete(itemId);
    this.addLog(itemId, itemLabel, null, CHECKLIST_EVENT_ACTION.DELETED);
  }

  async setChecklistItemChecked(
    _widgetId: string,
    itemId: string,
    checked: boolean,
  ): Promise<ChecklistItem> {
    const label = this.checklistLabels.get(itemId) ?? "항목";
    this.addLog(
      itemId,
      label,
      null,
      checked
        ? CHECKLIST_EVENT_ACTION.CHECKED
        : CHECKLIST_EVENT_ACTION.UNCHECKED,
    );
    return { id: itemId, label, checked };
  }

  async listChecklistLogs(): Promise<ChecklistLogPage> {
    return { items: [...this.checklistLogs], nextOffset: null };
  }

  blockNextLayoutSave(): () => void {
    let release = (): void => undefined;
    this.nextLayoutSaveGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  }

  private addLog(
    itemId: string,
    itemLabel: string,
    previousItemLabel: string | null,
    action: ChecklistLogEvent["action"],
  ): void {
    this.checklistLogs.unshift({
      id: `event-${this.checklistLogs.length + 1}`,
      itemId,
      itemLabel,
      previousItemLabel,
      action,
      businessDate: "2026-08-20",
      occurredAt: "2026-08-20T01:00:00.000Z",
    });
  }
}

class FakeFilesystemGateway implements FilesystemGateway {
  private readonly entries: FilesystemEntry[] = [];
  private readonly trash: Array<FilesystemTrashPage["items"][number]> = [];
  private nextId = 1;
  private readonly root: FilesystemDirectoryEntry = {
    id: FILESYSTEM_ROOT_ID.DOCUMENTS,
    parentId: null,
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name: "내 문서",
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    desktopOrder: null,
  };
  private readonly desktopRoot: FilesystemDirectoryEntry = {
    id: FILESYSTEM_ROOT_ID.DESKTOP,
    parentId: null,
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name: "바탕 화면",
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    desktopOrder: null,
  };

  addFile(
    name: string,
    contentType: string,
    parentId = this.root.id,
  ): FilesystemFileEntry {
    const entry: FilesystemFileEntry = {
      id: `file-${this.nextId++}`,
      parentId,
      kind: FILESYSTEM_ENTRY_KIND.FILE,
      name,
      contentType,
      size: 10,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
      desktopOrder:
        parentId === this.desktopRoot.id
          ? this.entries.filter(
              (candidate) => candidate.parentId === this.desktopRoot.id,
            ).length
          : null,
    };
    this.entries.push(entry);
    return entry;
  }

  addWidgetFile(widget: DashboardWidget): FilesystemWidgetEntry {
    if (!widget.file) throw new Error("Widget file reference is required");
    const entry: FilesystemWidgetEntry = {
      id: widget.file.entryId,
      parentId: widget.file.parentId,
      kind: FILESYSTEM_ENTRY_KIND.WIDGET,
      name: widget.file.name,
      widgetId: widget.id,
      widgetType: widget.type,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
      desktopOrder: null,
    };
    this.entries.push(entry);
    return entry;
  }

  async listDirectory(parentId = this.root.id): Promise<FilesystemDirectoryPage> {
    const directory =
      parentId === this.desktopRoot.id
        ? this.desktopRoot
        : parentId === this.root.id
          ? this.root
        : (this.entries.find(
            (entry): entry is FilesystemDirectoryEntry =>
              entry.id === parentId &&
              entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY,
          ) ?? this.root);
    return {
      directory,
      breadcrumbs:
        directory.id === this.root.id
          ? [{ id: this.root.id, name: this.root.name }]
          : [
              { id: this.root.id, name: this.root.name },
              { id: directory.id, name: directory.name },
            ],
      items: this.entries.filter((entry) => entry.parentId === directory.id),
      nextOffset: null,
    };
  }

  async createDirectory(parentId: string, name: string): Promise<FilesystemDirectoryEntry> {
    const directory: FilesystemDirectoryEntry = {
      id: `folder-${this.nextId++}`,
      parentId,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
      desktopOrder: null,
    };
    this.entries.push(directory);
    return directory;
  }

  async uploadFile(parentId: string, file: File): Promise<FilesystemFileEntry> {
    const entry: FilesystemFileEntry = {
      id: `file-${this.nextId++}`,
      parentId,
      kind: FILESYSTEM_ENTRY_KIND.FILE,
      name: file.name,
      contentType: file.type,
      size: file.size,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
      desktopOrder: null,
    };
    this.entries.push(entry);
    return entry;
  }

  async updateEntry(id: string, input: UpdateFilesystemEntryInput): Promise<FilesystemEntry> {
    const index = this.entries.findIndex((entry) => entry.id === id);
    const entry = this.entries[index];
    if (!entry) throw new Error("Entry not found");
    const updated = {
      ...entry,
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
    } as FilesystemEntry;
    this.entries[index] = updated;
    return updated;
  }

  async moveEntry(
    id: string,
    input: MoveFilesystemEntryInput,
  ): Promise<FilesystemEntry> {
    return this.updateEntry(id, { parentId: input.parentId });
  }

  async trashEntry(id: string) {
    const index = this.entries.findIndex((entry) => entry.id === id);
    const entry = this.entries[index];
    if (!entry) return { entry: null, closedWidgetIds: [] };
    this.entries.splice(index, 1);
    this.trash.push({
      entry,
      deletedAt: "2026-08-20T00:00:00.000Z",
      originalParentId: entry.parentId,
      originalLocation: "내 문서",
    });
    return { entry: null, closedWidgetIds: [] };
  }

  downloadUrl(id: string): string {
    return `/api/files/${id}/download`;
  }

  contentUrl(id: string): string {
    return `/api/files/${id}/content`;
  }

  thumbnailUrl(id: string): string {
    return `/api/files/${id}/thumbnail`;
  }

  async listTrash(): Promise<FilesystemTrashPage> {
    return { items: [...this.trash], nextOffset: null };
  }

  async restoreEntry(id: string): Promise<FilesystemEntry> {
    const index = this.trash.findIndex((item) => item.entry.id === id);
    const item = this.trash[index];
    if (!item) throw new Error("Entry not found");
    this.trash.splice(index, 1);
    this.entries.push(item.entry);
    return item.entry;
  }

  async permanentlyDeleteEntry(id: string): Promise<void> {
    const index = this.trash.findIndex((item) => item.entry.id === id);
    if (index >= 0) this.trash.splice(index, 1);
  }

  async emptyTrash(): Promise<void> {
    this.trash.splice(0);
  }
}

async function openStartMenu(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.click(
    await screen.findByRole("button", { name: DASHBOARD_COPY.START }),
  );
}

async function addWidget(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
): Promise<void> {
  await openStartMenu(user);
  await user.click(screen.getByRole("button", { name: label }));
}

function memoWidget(id: string): DashboardWidget {
  const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];
  return {
    id,
    type: WIDGET_TYPE.MEMO,
    position: { x: 32, y: 32 },
    size: {
      width: policy.DEFAULT_WIDTH,
      height: policy.DEFAULT_HEIGHT,
    },
    windowState: WINDOW_STATE.NORMAL,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
    stackOrder: 0,
    file: {
      entryId: `entry-${id}`,
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: MEMO_WIDGET_COPY.TITLE,
    },
    data: { markdown: "", updatedAt: null },
  };
}

function checklistWidget(id: string, stackOrder: number): DashboardWidget {
  const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.DAILY_CHECKLIST];
  return {
    id,
    type: WIDGET_TYPE.DAILY_CHECKLIST,
    position: { x: 64, y: 64 },
    size: {
      width: policy.DEFAULT_WIDTH,
      height: policy.DEFAULT_HEIGHT,
    },
    windowState: WINDOW_STATE.NORMAL,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
    stackOrder,
    file: {
      entryId: `entry-${id}`,
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: CHECKLIST_WIDGET_COPY.TITLE,
    },
    data: {
      businessDate: "2026-08-20",
      nextResetAt: "2026-08-20T15:00:00.000Z",
      items: [],
    },
  };
}

function desktopWindowTitles(): Array<string | undefined> {
  return screen
    .queryAllByTestId("desktop-window")
    .map(
      (window) =>
        window.querySelector(".xp-window-frame__title")?.textContent ??
        undefined,
    );
}

function desktopWindowByTitle(title: string): HTMLElement {
  const window = screen.getAllByTestId("desktop-window").find(
    (candidate) =>
      candidate.querySelector(".xp-window-frame__title")?.textContent ===
      title,
  );
  if (!window) {
    throw new Error(`Desktop window not found: ${title}`);
  }
  return window;
}
