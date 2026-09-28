import { useWidgetLayoutAutoSave } from "@client/hooks/widgets/use-widget-layout-auto-save";
import { LAYOUT_SAVE_DEBOUNCE_MILLISECONDS } from "@client/constants/desktop/layout-save";
import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import type { CSSProperties, ReactNode } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
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
    vi.useFakeTimers();
    const api = new FakeDashboardGateway();
    const memo = memoWidget("00000000-0000-4000-8000-000000000301");
    const checklist = checklistWidget("00000000-0000-4000-8000-000000000302", 1);
    const releaseFirstSave = api.blockNextLayoutSave();
    const onSaved = vi.fn();
    const view = renderHook(() => useWidgetLayoutAutoSave(api, {
      onSaved, fallbackErrorMessage: "save failed",
    }));
    try {
      act(() => view.result.current.schedule([memo, checklist]));
      await act(async () => { await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DEBOUNCE_MILLISECONDS); });
      expect(api.layoutSaveCalls).toHaveLength(1);
      act(() => view.result.current.schedule([{ ...memo, windowState: WINDOW_STATE.MAXIMIZED }, checklist]));
      act(() => view.result.current.schedule([{ ...memo, windowState: WINDOW_STATE.MINIMIZED,
        restoreState: WINDOW_RESTORE_STATE.MAXIMIZED }, checklist]));
      await act(async () => { await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DEBOUNCE_MILLISECONDS); });
      expect(api.layoutSaveCalls).toHaveLength(1);
      await act(async () => { releaseFirstSave(); });
      expect(api.layoutSaveCalls).toHaveLength(2);
      expect(api.layoutSaveCalls[1]?.find((widget) => widget.id === memo.id)).toMatchObject({
        windowState: WINDOW_STATE.MINIMIZED, restoreState: WINDOW_RESTORE_STATE.MAXIMIZED,
      });
      expect(onSaved).toHaveBeenCalledTimes(2);
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
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

  it("saves an edited memo through the application gateway", async () => {
    const api = new FakeDashboardGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);
    await launchApplication(user, APPLICATION_NAME_BY_TYPE[WIDGET_TYPE.MEMO]);
    await user.click(await screen.findByRole("button", { name: MEMO_WIDGET_COPY.EDIT }));
    fireEvent.change(screen.getByRole("textbox", { name: MEMO_WIDGET_COPY.EDITOR_LABEL }), {
      target: { value: "# 저장한 메모" },
    });
    await user.click(screen.getByRole("button", { name: MEMO_WIDGET_COPY.SAVE }));
    expect(await screen.findByRole("heading", { name: "저장한 메모" })).toBeInTheDocument();
    expect(api.savedWidgets[0]).toMatchObject({ data: { markdown: "# 저장한 메모" } });
  });

  it("adds a checklist item through the application gateway and opens its log", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-20T00:00:00.000Z"));
    const api = new FakeDashboardGateway();
    const add = vi.spyOn(api, "addChecklistItem");
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={new FakeFilesystemGateway()} />);
    await launchApplication(user, APPLICATION_NAME_BY_TYPE[WIDGET_TYPE.DAILY_CHECKLIST]);
    await user.click(await screen.findByRole("button", { name: CHECKLIST_WIDGET_COPY.EDIT }));
    fireEvent.change(screen.getByRole("textbox", { name: CHECKLIST_WIDGET_COPY.NEW_ITEM_PLACEHOLDER }), {
      target: { value: "물 마시기" },
    });
    await user.click(screen.getByRole("button", { name: CHECKLIST_WIDGET_COPY.ADD_ITEM }));
    expect(await screen.findByRole("checkbox", { name: "물 마시기" })).toBeInTheDocument();
    expect(add).toHaveBeenCalledWith(api.savedWidgets[0]?.id, "물 마시기");
    await user.click(screen.getByRole("button", { name: CHECKLIST_WIDGET_COPY.DETAILS }));
    expect(await screen.findByRole("dialog", { name: CHECKLIST_WIDGET_COPY.LOG_TITLE })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: CHECKLIST_WIDGET_COPY.ADDED })).toBeInTheDocument();
  });

});

function windowZIndex(window: HTMLElement): number {
  return Number(window.style.zIndex);
}
