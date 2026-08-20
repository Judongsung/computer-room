import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/client/app";
import {
  DASHBOARD_LAYOUT,
  UI_MESSAGES,
} from "../../src/client/constants/dashboard";
import {
  DASHBOARD_COPY,
  CHECKLIST_WIDGET_COPY,
  MEMO_WIDGET_COPY,
} from "../../src/client/constants/content";
import type { DashboardGateway } from "../../src/client/types/api";
import { ACCESS_LOGOUT_PATH } from "../../src/constants/auth";
import { MAX_FILE_SIZE_BYTES } from "../../src/constants/file";
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
import { cloneDashboardWidgets } from "../../src/domain/widget-layout";
import { WIDGET_SIZE_BY_TYPE, WIDGET_TYPE } from "../../src/constants/widget";
import { CHECKLIST_EVENT_ACTION } from "../../src/constants/checklist";

vi.mock("react-grid-layout", () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="desktop-grid">{children}</div>
  ),
  useContainerWidth: () => ({
    width: DASHBOARD_LAYOUT.MAX_WIDTH_PX,
    containerRef: () => undefined,
    mounted: true,
  }),
  noCompactor: {
    type: null,
    allowOverlap: false,
    compact: (layout: unknown) => layout,
  },
}));

const SESSION: SessionInfo = {
  email: "owner@example.com",
  logoutUrl: ACCESS_LOGOUT_PATH,
  filePolicy: { maxUploadSizeBytes: MAX_FILE_SIZE_BYTES },
};

describe("App", () => {
  beforeEach(() => setDesktop(true));

  it("adds and saves a memo widget from an initially empty board", async () => {
    const api = new FakeDashboardGateway();
    const user = userEvent.setup();
    render(<App api={api} />);

    expect(await screen.findByText(SESSION.email)).toBeInTheDocument();
    expect(screen.getByText(UI_MESSAGES.EMPTY_BOARD)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.EDIT }),
    );
    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.ADD_MEMO_WIDGET }),
    );
    expect(screen.getByText(MEMO_WIDGET_COPY.EMPTY_CONTENT)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: MEMO_WIDGET_COPY.DELETE_LABEL }),
    ).toHaveAttribute("title", MEMO_WIDGET_COPY.DELETE_LABEL);

    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.SAVE }),
    );
    await waitFor(() => expect(api.savedWidgets).toHaveLength(1));
    expect(await screen.findByText(UI_MESSAGES.SAVE_COMPLETE)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DASHBOARD_COPY.EDIT }),
    ).toBeInTheDocument();
  });

  it("discards an unsaved widget when editing is cancelled", async () => {
    const user = userEvent.setup();
    render(<App api={new FakeDashboardGateway()} />);
    await screen.findByText(SESSION.email);

    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.EDIT }),
    );
    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.ADD_MEMO_WIDGET }),
    );
    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.CANCEL }),
    );

    expect(
      screen.queryByText(MEMO_WIDGET_COPY.EMPTY_CONTENT),
    ).not.toBeInTheDocument();
    expect(screen.getByText(UI_MESSAGES.EMPTY_BOARD)).toBeInTheDocument();
  });

  it("renders a one-column view without editing controls on a narrow screen", async () => {
    setDesktop(false);
    render(<App api={new FakeDashboardGateway()} />);

    await screen.findByText(SESSION.email);
    expect(
      screen.queryByRole("button", { name: DASHBOARD_COPY.EDIT }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(UI_MESSAGES.MOBILE_EDIT_NOTICE)).toBeInTheDocument();
  });

  it("keeps widget content editable on a narrow screen", async () => {
    setDesktop(false);
    const api = new FakeDashboardGateway();
    const size = WIDGET_SIZE_BY_TYPE[WIDGET_TYPE.MEMO];
    api.savedWidgets = [
      {
        id: "00000000-0000-4000-8000-000000000301",
        type: WIDGET_TYPE.MEMO,
        position: { column: 0, row: 0 },
        size: {
          columns: size.DEFAULT_COLUMNS,
          rows: size.DEFAULT_ROWS,
        },
        data: { markdown: "모바일 메모", updatedAt: null },
      },
    ];
    const user = userEvent.setup();
    render(<App api={api} />);

    await screen.findByText("모바일 메모");
    const editButton = screen.getByRole("button", {
      name: MEMO_WIDGET_COPY.EDIT,
    });
    expect(editButton).toHaveAttribute("title", MEMO_WIDGET_COPY.EDIT);
    expect(editButton).toHaveTextContent("");
    await user.click(editButton);
    expect(
      screen.getByRole("textbox", { name: MEMO_WIDGET_COPY.EDITOR_LABEL }),
    ).toBeEnabled();
  });

  it("edits and renders a memo with GFM markdown", async () => {
    const api = new FakeDashboardGateway();
    const user = userEvent.setup();
    const markdown =
      "# 오늘\n\n**중요**\n다음 줄\n\n~~완료~~\n\n- [x] 확인\n\n<script>alert('x')</script>";
    render(<App api={api} />);
    await screen.findByText(SESSION.email);

    await user.click(screen.getByRole("button", { name: DASHBOARD_COPY.EDIT }));
    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.ADD_MEMO_WIDGET }),
    );
    await user.click(screen.getByRole("button", { name: DASHBOARD_COPY.SAVE }));
    await screen.findByText(UI_MESSAGES.SAVE_COMPLETE);

    await user.click(screen.getByRole("button", { name: MEMO_WIDGET_COPY.EDIT }));
    const writeTab = screen.getByRole("tab", { name: MEMO_WIDGET_COPY.WRITE });
    const previewTab = screen.getByRole("tab", {
      name: MEMO_WIDGET_COPY.PREVIEW,
    });
    expect(
      screen.getByRole("tablist", { name: MEMO_WIDGET_COPY.TABS_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tabpanel", { name: MEMO_WIDGET_COPY.WRITE }),
    ).toBeInTheDocument();
    writeTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(previewTab).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    expect(writeTab).toHaveAttribute("aria-selected", "true");
    const editor = screen.getByRole("textbox", {
      name: MEMO_WIDGET_COPY.EDITOR_LABEL,
    });
    await user.click(editor);
    await user.paste(markdown);
    await user.click(
      screen.getByRole("tab", { name: MEMO_WIDGET_COPY.PREVIEW }),
    );
    expect(screen.getByRole("heading", { name: "오늘" })).toBeInTheDocument();
    expect(screen.getByText("중요").tagName).toBe("STRONG");
    expect(screen.getByText("완료").tagName).toBe("DEL");
    const markdownContent = document.querySelector(".markdown-content");
    expect(markdownContent?.querySelectorAll("br")).toHaveLength(1);
    expect(markdownContent?.querySelector("script")).toBeNull();
    const markdownTask = markdownContent?.querySelector<HTMLInputElement>(
      '.task-list-item > input[type="checkbox"]',
    );
    expect(markdownTask).toBeChecked();
    expect(markdownTask).toBeDisabled();

    await user.click(screen.getByRole("button", { name: MEMO_WIDGET_COPY.SAVE }));
    await waitFor(() =>
      expect(
        api.savedWidgets[0]?.type === WIDGET_TYPE.MEMO
          ? api.savedWidgets[0].data.markdown
          : null,
      ).toBe(markdown),
    );
  });

  it("adds and checks an item and opens its event log", async () => {
    const api = new FakeDashboardGateway();
    const user = userEvent.setup();
    render(<App api={api} />);
    await screen.findByText(SESSION.email);

    await user.click(screen.getByRole("button", { name: DASHBOARD_COPY.EDIT }));
    await user.click(
      screen.getByRole("button", {
        name: DASHBOARD_COPY.ADD_CHECKLIST_WIDGET,
      }),
    );
    await user.click(screen.getByRole("button", { name: DASHBOARD_COPY.SAVE }));
    await screen.findByText(UI_MESSAGES.SAVE_COMPLETE);

    expect(
      screen.queryByRole("textbox", {
        name: CHECKLIST_WIDGET_COPY.NEW_ITEM_PLACEHOLDER,
      }),
    ).not.toBeInTheDocument();
    const checklistEditButton = screen.getByRole("button", {
      name: CHECKLIST_WIDGET_COPY.EDIT,
    });
    expect(checklistEditButton).toHaveAttribute(
      "title",
      CHECKLIST_WIDGET_COPY.EDIT,
    );
    await user.click(checklistEditButton);

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
    expect(checkbox.nextElementSibling).toHaveAttribute("for", checkbox.id);
    expect(
      screen.getByRole("button", { name: CHECKLIST_WIDGET_COPY.EDIT_ITEM }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: CHECKLIST_WIDGET_COPY.DELETE_ITEM }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: CHECKLIST_WIDGET_COPY.FINISH_EDITING }),
    );
    expect(
      screen.queryByRole("textbox", {
        name: CHECKLIST_WIDGET_COPY.NEW_ITEM_PLACEHOLDER,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: CHECKLIST_WIDGET_COPY.EDIT_ITEM }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: CHECKLIST_WIDGET_COPY.DELETE_ITEM }),
    ).not.toBeInTheDocument();

    await user.click(checkbox);
    await waitFor(() => expect(screen.getByText("물 마시기").tagName).toBe("DEL"));

    await user.click(
      screen.getByRole("button", { name: CHECKLIST_WIDGET_COPY.DETAILS }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(CHECKLIST_WIDGET_COPY.CHECKED)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: CHECKLIST_WIDGET_COPY.CLOSE }),
    ).toHaveAttribute("title", CHECKLIST_WIDGET_COPY.CLOSE);
  });
});

class FakeDashboardGateway implements DashboardGateway {
  savedWidgets: DashboardWidget[] = [];
  readonly checklistLabels = new Map<string, string>();
  readonly checklistLogs: ChecklistLogEvent[] = [];
  private nextChecklistItem = 1;

  async getSession(): Promise<SessionInfo> {
    return SESSION;
  }

  async listWidgets(): Promise<DashboardWidget[]> {
    return cloneDashboardWidgets(this.savedWidgets);
  }

  async replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<DashboardWidget[]> {
    const existingById = new Map(
      this.savedWidgets.map((widget) => [widget.id, widget] as const),
    );
    this.savedWidgets = widgets.map((layout): DashboardWidget => {
      const existing = existingById.get(layout.id);
      if (existing?.type === layout.type) {
        return { ...existing, position: layout.position, size: layout.size };
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
    return { id, label, checked: false };
  }

  async updateChecklistItem(
    _widgetId: string,
    itemId: string,
    label: string,
  ): Promise<ChecklistItem> {
    this.checklistLabels.set(itemId, label);
    return { id: itemId, label, checked: false };
  }

  async deleteChecklistItem(_widgetId: string, itemId: string): Promise<void> {
    this.checklistLabels.delete(itemId);
  }

  async setChecklistItemChecked(
    _widgetId: string,
    itemId: string,
    checked: boolean,
  ): Promise<ChecklistItem> {
    const label = this.checklistLabels.get(itemId) ?? "항목";
    this.checklistLogs.unshift({
      id: `event-${this.checklistLogs.length + 1}`,
      itemId,
      itemLabel: label,
      action: checked
        ? CHECKLIST_EVENT_ACTION.CHECKED
        : CHECKLIST_EVENT_ACTION.UNCHECKED,
      businessDate: "2026-08-20",
      occurredAt: "2026-08-20T01:00:00.000Z",
    });
    return { id: itemId, label, checked };
  }

  async listChecklistLogs(): Promise<ChecklistLogPage> {
    return { items: [...this.checklistLogs], nextOffset: null };
  }
}

function setDesktop(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
