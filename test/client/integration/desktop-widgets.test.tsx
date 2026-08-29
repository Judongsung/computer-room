import { STORAGE_STATUS_COPY } from "@client/content/ko/storage/storage-status";
import { MEDIA_VIEWER_COPY } from "@client/content/ko/media/media";
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
  addWidget,
  checklistWidget,
  desktopWindowByTitle,
  desktopWindowTitles,
  emptyStorageStatusSnapshot,
  memoWidget,
  openStartMenu,
} from "@test/client/support/desktop/app-integration-helpers";

describe("App desktop widgets", () => {
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
    expect(
      await screen.findByText(MEMO_WIDGET_COPY.EMPTY_CONTENT),
    ).toBeInTheDocument();
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

  it("creates a widget from My Computer", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 컴퓨터" }));
    const computerWindow = await waitFor(() => desktopWindowByTitle("내 컴퓨터"));
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
    const documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
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

    const memoWindow = await waitFor(() =>
      desktopWindowByTitle(MEMO_WIDGET_COPY.TITLE),
    );
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
