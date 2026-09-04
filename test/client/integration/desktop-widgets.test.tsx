import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import type { CSSProperties, ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@client/app";
import {
  CHECKLIST_WIDGET_COPY,
  DASHBOARD_COPY,
  MEMO_WIDGET_COPY,
} from "@client/content/ko/widgets/content";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import { ACCESS_LOGOUT_PATH } from "@/constants/platform/auth";
import { WIDGET_TYPE, WINDOW_RESTORE_STATE, WINDOW_STATE } from "@/constants/widgets/widget";

vi.mock("react-rnd", () => ({
  Rnd: ({
    children,
    style,
  }: {
    readonly children: ReactNode;
    readonly style?: CSSProperties;
  }) => (
    <div data-testid="desktop-window" style={style}>
      {children}
    </div>
  ),
}));
import { SESSION } from "@test/support/desktop/app-test-session";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { desktopWindowByTitle, desktopWindowTitles, launchApplication, openStartMenu } from "@test/client/support/desktop/app-integration-helpers";
import { APPLICATION_NAME_BY_TYPE } from "@client/content/ko/desktop/application";
import { checklistWidget, memoWidget } from "@test/support/widgets/dashboard-fixtures";

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
      screen.getByRole("button", {
        name: APPLICATION_NAME_BY_TYPE[WIDGET_TYPE.MEMO],
      }),
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

    await launchApplication(
      user,
      APPLICATION_NAME_BY_TYPE[WIDGET_TYPE.MEMO],
    );
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

  it("shows a framed save prompt and preserves cancel and discard behavior", async () => {
    const api = new FakeDashboardGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);

    await launchApplication(
      user,
      APPLICATION_NAME_BY_TYPE[WIDGET_TYPE.MEMO],
    );
    const memoWindow = await waitFor(() =>
      desktopWindowByTitle(MEMO_WIDGET_COPY.UNSAVED_TITLE),
    );
    await user.click(
      within(memoWindow).getByRole("button", { name: DASHBOARD_COPY.CLOSE }),
    );

    let dialog = screen.getByRole("dialog", {
      name: FILESYSTEM_COPY.UNSAVED_CLOSE_TITLE,
    });
    expect(dialog.querySelectorAll(".xp-window-frame")).toHaveLength(1);
    expect(dialog.querySelector(".xp-window-frame__title-bar")).not.toBeNull();
    expect(dialog.querySelector("img")).toHaveAttribute(
      "src",
      WIDGET_ICON_PATH_BY_TYPE[WIDGET_TYPE.MEMO],
    );
    await user.click(
      within(dialog).getByRole("button", { name: FILESYSTEM_COPY.CANCEL }),
    );
    expect(
      screen.queryByRole("dialog", {
        name: FILESYSTEM_COPY.UNSAVED_CLOSE_TITLE,
      }),
    ).not.toBeInTheDocument();
    expect(desktopWindowByTitle(MEMO_WIDGET_COPY.UNSAVED_TITLE)).toBeInTheDocument();

    await user.click(
      within(memoWindow).getByRole("button", { name: DASHBOARD_COPY.CLOSE }),
    );
    dialog = screen.getByRole("dialog", {
      name: FILESYSTEM_COPY.UNSAVED_CLOSE_TITLE,
    });
    await user.click(
      within(dialog).getByRole("button", { name: FILESYSTEM_COPY.DONT_SAVE }),
    );
    await waitFor(() =>
      expect(desktopWindowTitles()).not.toContain(
        MEMO_WIDGET_COPY.UNSAVED_TITLE,
      ),
    );
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
      within(documentsWindow).getByRole("menuitem", {
        name: XP_EXPLORER_HEADER_COPY.FILE_MENU,
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: FILESYSTEM_COPY.RENAME }),
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

  it("opens a widget file above the explorer window", async () => {
    const api = new FakeDashboardGateway();
    const widget = memoWidget("00000000-0000-4000-8000-000000000402");
    api.savedWidgets = [widget];
    vi.spyOn(api, "listWidgets").mockResolvedValue([]);
    const filesystem = new FakeFilesystemGateway();
    filesystem.addWidgetFile(widget);
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(
      await screen.findByRole("button", { name: "내 문서" }),
    );
    const documentsWindow = await waitFor(() =>
      desktopWindowByTitle("내 문서"),
    );
    await user.dblClick(
      await within(documentsWindow).findByRole("button", {
        name: MEMO_WIDGET_COPY.TITLE,
      }),
    );
    await screen.findByText(MEMO_WIDGET_COPY.EMPTY_CONTENT);
    const widgetWindow = desktopWindowByTitle(MEMO_WIDGET_COPY.TITLE);

    await waitFor(() =>
      expect(windowZIndex(widgetWindow)).toBeGreaterThan(
        windowZIndex(documentsWindow),
      ),
    );
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

    await launchApplication(
      user,
      APPLICATION_NAME_BY_TYPE[WIDGET_TYPE.MEMO],
    );
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
    await launchApplication(
      user,
      APPLICATION_NAME_BY_TYPE[WIDGET_TYPE.MEMO],
    );
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
    await launchApplication(
      user,
      APPLICATION_NAME_BY_TYPE[WIDGET_TYPE.DAILY_CHECKLIST],
    );
    await waitFor(() => expect(api.savedWidgets).toHaveLength(1));

    expect(
      screen.queryByRole("textbox", {
        name: CHECKLIST_WIDGET_COPY.NEW_ITEM_PLACEHOLDER,
      }),
    ).not.toBeInTheDocument();
    await user.click(
      await screen.findByRole("button", { name: CHECKLIST_WIDGET_COPY.EDIT }),
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
    const logDialog = await screen.findByRole("dialog", {
      name: CHECKLIST_WIDGET_COPY.LOG_TITLE,
    });
    expect(logDialog.querySelectorAll(".xp-window-frame")).toHaveLength(1);
    expect(logDialog.querySelector(".checklist-log-dialog")).toBe(
      logDialog.querySelector(".xp-window-frame"),
    );
    expect(logDialog.querySelector(".sunken-panel")).toBeNull();
    expect(screen.getByText(CHECKLIST_WIDGET_COPY.ADDED)).toBeInTheDocument();
    expect(screen.getByText(CHECKLIST_WIDGET_COPY.RENAMED)).toBeInTheDocument();
    expect(screen.getByText("물 마시기 → 물 두 잔 마시기")).toBeInTheDocument();
    expect(screen.getByText(CHECKLIST_WIDGET_COPY.CHECKED)).toBeInTheDocument();
  });
});

function windowZIndex(window: HTMLElement): number {
  return Number(window.style.zIndex);
}
