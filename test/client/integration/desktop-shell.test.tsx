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
} from "@client/constants/widgets/content";
import { STORAGE_STATUS_COPY } from "@client/constants/storage/storage-status";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import { FILESYSTEM_COPY } from "@client/constants/filesystem/filesystem";
import { FILESYSTEM_SORT_COPY } from "@client/constants/filesystem/sort";
import { FOLDER_PROPERTIES_COPY } from "@client/constants/filesystem/details";
import { MEDIA_VIEWER_COPY } from "@client/constants/media/media";
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
import { cloneDashboardWidgets } from "@/domain/widgets/widget-layout";
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
  addWidget,
  checklistWidget,
  desktopWindowByTitle,
  desktopWindowTitles,
  emptyStorageStatusSnapshot,
  memoWidget,
  openStartMenu,
} from "@test/client/support/desktop/app-integration-helpers";

describe("App desktop shell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it("minimizes, restores, maximizes, and closes a system app", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    let documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
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
    documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
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

  it("opens an XP menu on blank desktop space and launches the storage widget", async () => {
    const api = new FakeDashboardGateway();
    const storageStatus = emptyStorageStatusSnapshot();
    const user = userEvent.setup();
    render(
      <App
        api={api}
        filesystemApi={new FakeFilesystemGateway()}
        storageStatusApi={{ getStatus: vi.fn().mockResolvedValue(storageStatus) }}
      />,
    );
    const desktop = await screen.findByRole("main", {
      name: DASHBOARD_COPY.DESKTOP,
    });

    fireEvent.contextMenu(desktop, { clientX: 200, clientY: 180 });
    expect(
      screen.getByRole("menuitem", { name: FILESYSTEM_COPY.NEW_FOLDER }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("menuitem", {
        name: DASHBOARD_COPY.ADD_STORAGE_STATUS_WIDGET,
      }),
    );

    expect(await screen.findByText(STORAGE_STATUS_COPY.R2_TITLE)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: DASHBOARD_COPY.SAVE_AS_FILE }),
    ).not.toBeInTheDocument();
  });

  it("shows window controls from a taskbar item's XP menu", async () => {
    const api = new FakeDashboardGateway();
    api.savedWidgets = [memoWidget("00000000-0000-4000-8000-000000000399")];
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);
    await screen.findByText(MEMO_WIDGET_COPY.EMPTY_CONTENT);
    const taskbar = screen.getByRole("contentinfo", {
      name: DASHBOARD_COPY.TASKBAR,
    });

    fireEvent.contextMenu(
      within(taskbar).getByRole("button", { name: MEMO_WIDGET_COPY.TITLE }),
    );
    expect(
      screen.getByRole("menuitem", { name: DASHBOARD_COPY.MINIMIZE }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("menuitem", { name: DASHBOARD_COPY.MAXIMIZE }),
    );
    const memoWindow = await waitFor(() =>
      desktopWindowByTitle(MEMO_WIDGET_COPY.TITLE),
    );
    expect(
      within(memoWindow).getByRole("button", {
        name: DASHBOARD_COPY.RESTORE,
      }),
    ).toBeInTheDocument();
  });
});
