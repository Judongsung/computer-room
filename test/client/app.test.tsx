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
import { ACCESS_LOGOUT_PATH } from "../../src/constants/auth";
import { CHECKLIST_EVENT_ACTION } from "../../src/constants/checklist";
import { MAX_FILE_SIZE_BYTES } from "../../src/constants/file";
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
  MemoData,
  WidgetLayout,
} from "../../src/types/widget";

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
    render(<App api={api} />);

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
      screen.getByRole("button", { name: DASHBOARD_COPY.CLOSE_DISABLED }),
    ).toBeDisabled();
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
    render(<App api={api} />);

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
    render(<App api={api} />);

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
    render(<App api={api} />);

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
    render(<App api={api} />);

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

  it("serializes auto-saves and sends only the latest queued window state", async () => {
    const api = new FakeDashboardGateway();
    api.savedWidgets = [
      memoWidget("00000000-0000-4000-8000-000000000301"),
      checklistWidget("00000000-0000-4000-8000-000000000302", 1),
    ];
    const releaseFirstSave = api.blockNextLayoutSave();
    const user = userEvent.setup();
    render(<App api={api} />);

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
    render(<App api={api} />);

    await addWidget(user, DASHBOARD_COPY.ADD_MEMO_WIDGET);
    expect(screen.getByText(MEMO_WIDGET_COPY.EMPTY_CONTENT)).toBeInTheDocument();
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
    render(<App api={api} />);
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
    render(<App api={api} />);
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
            data: { markdown: "", updatedAt: null },
          }
        : {
            ...layout,
            type: WIDGET_TYPE.DAILY_CHECKLIST,
            data: {
              businessDate: "2026-08-20",
              nextResetAt: "2026-08-20T15:00:00.000Z",
              items: [],
            },
          };
    });
    return cloneDashboardWidgets(this.savedWidgets);
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
    data: {
      businessDate: "2026-08-20",
      nextResetAt: "2026-08-20T15:00:00.000Z",
      items: [],
    },
  };
}

function desktopWindowTitles(): Array<string | undefined> {
  return screen
    .getAllByTestId("desktop-window")
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
