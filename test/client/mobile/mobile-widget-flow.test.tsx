import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { MEMO_HISTORY_COPY } from "@client/content/ko/widgets/memo-history";
import { MEMO_WIDGET_COPY } from "@client/content/ko/widgets/content";
import {
  LOCAL_WIDGET_DRAFT_STORAGE_KEY,
  LOCAL_WIDGET_DRAFT_VERSION,
} from "@client/constants/widgets/local-widget-draft";
import {
  dashboardGateway,
  filesystemGateway,
  renderMobile,
} from "@test/support/mobile/mobile-app-test-helpers";
import { widgetDocument, widgetEntry } from "@test/support/mobile/mobile-fixtures";

describe("mobile widget flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("creates one local memo draft from My Computer", async () => {
    const user = userEvent.setup();
    renderMobile();
    await screen.findByRole("main", { name: MOBILE_COPY.HOME_SCREEN });
    await user.click(
      screen.getByRole("button", { name: MOBILE_COPY.MY_COMPUTER }),
    );
    expect(
      screen.getByRole("button", { name: MOBILE_COPY.MENU }),
    ).toBeDisabled();
    await user.click(
      await screen.findByRole("button", { name: MOBILE_COPY.CREATE_MEMO }),
    );

    expect(await screen.findByRole("textbox")).toBeInTheDocument();
    const stored = JSON.parse(
      window.localStorage.getItem(LOCAL_WIDGET_DRAFT_STORAGE_KEY) ?? "null",
    ) as { type?: string; version?: number } | null;
    expect(stored).toMatchObject({
      type: WIDGET_TYPE.MEMO,
      version: LOCAL_WIDGET_DRAFT_VERSION,
    });
  });

  it("resumes the last local draft instead of PC widgets after reload", async () => {
    window.localStorage.setItem(
      LOCAL_WIDGET_DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: LOCAL_WIDGET_DRAFT_VERSION,
        id: "local-draft",
        type: WIDGET_TYPE.MEMO,
        markdown: "휴대폰 초안",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
    const listWidgets = vi.fn(async () => []);
    renderMobile({ dashboard: dashboardGateway(listWidgets) });

    expect(await screen.findByDisplayValue("휴대폰 초안")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: MEMO_HISTORY_COPY.OPEN })).not.toBeInTheDocument();
    expect(listWidgets).not.toHaveBeenCalled();
  });

  it("reads a saved widget file without opening the PC widget window", async () => {
    const entry = widgetEntry();
    const document = widgetDocument(entry);
    const getWidgetFile = vi.fn(async () => document);
    const openWidget = vi.fn();
    const dashboard = dashboardGateway();
    dashboard.openWidget = openWidget;
    const user = userEvent.setup();

    renderMobile({
      dashboard,
      filesystem: filesystemGateway([entry]),
      widgetFileApi: {
        getWidgetFile,
        createWidgetFile: vi.fn(async () => {
          throw new Error("Unexpected widget file creation.");
        }),
      },
    });

    await user.click(await screen.findByRole("button", { name: entry.name }));

    expect(await screen.findByText("모바일에서도 읽는 메모")).toBeInTheDocument();
    expect(getWidgetFile).toHaveBeenCalledWith(entry.id);
    expect(openWidget).not.toHaveBeenCalled();
  });

  it("keeps an edited widget open until leaving is confirmed", async () => {
    const entry = widgetEntry();
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const user = userEvent.setup();

    renderMobile({
      filesystem: filesystemGateway([entry]),
      widgetFileApi: {
        getWidgetFile: vi.fn(async () => widgetDocument(entry)),
        createWidgetFile: vi.fn(async () => {
          throw new Error("Unexpected widget file creation.");
        }),
      },
    });

    await user.click(await screen.findByRole("button", { name: entry.name }));
    await user.click(
      await screen.findByRole("button", { name: MOBILE_COPY.EDIT }),
    );
    await user.type(screen.getByRole("textbox"), " changed");

    await user.click(screen.getByRole("button", { name: MOBILE_COPY.HOME }));
    expect(confirm).toHaveBeenCalledWith(MOBILE_COPY.UNSAVED_CHANGES);
    expect(
      screen.getByRole("heading", { name: entry.name }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: MOBILE_COPY.HOME }));
    expect(
      await screen.findByRole("main", { name: MOBILE_COPY.HOME_SCREEN }),
    ).toBeInTheDocument();
  });

  it("loads a saved memo version into the mobile editor without writing until save", async () => {
    const entry = widgetEntry();
    const dashboard = dashboardGateway();
    dashboard.listMemoVersions = vi.fn(async () => ({ items: [{ version: 2, savedAt: null }] }));
    dashboard.getMemoVersion = vi.fn(async () => ({ version: 2, savedAt: null, markdown: "# 이전 모바일 메모" }));
    dashboard.updateMemo = vi.fn(async (_id, markdown) => ({ markdown, updatedAt: null }));
    const user = userEvent.setup();
    renderMobile({ dashboard, filesystem: filesystemGateway([entry]),
      widgetFileApi: { getWidgetFile: vi.fn(async () => widgetDocument(entry)),
        createWidgetFile: vi.fn(async () => { throw new Error("Unexpected widget file creation."); }) } });
    await user.click(await screen.findByRole("button", { name: entry.name }));
    await user.click(await screen.findByRole("button", { name: MEMO_HISTORY_COPY.OPEN }));
    expect(await screen.findByRole("heading", { name: "이전 모바일 메모" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: MEMO_HISTORY_COPY.LOAD_DRAFT }));
    expect(screen.getByRole("textbox", { name: MEMO_WIDGET_COPY.EDITOR_LABEL })).toHaveValue("# 이전 모바일 메모");
    expect(dashboard.updateMemo).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: MEMO_HISTORY_COPY.OPEN })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: MOBILE_COPY.DISCARD_CHANGES }));
    expect(screen.getByText("모바일에서도 읽는 메모")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: MEMO_HISTORY_COPY.OPEN }));
    await user.click(await screen.findByRole("button", { name: MEMO_HISTORY_COPY.LOAD_DRAFT }));
    await user.click(screen.getByRole("button", { name: MOBILE_COPY.SAVE_LOCAL }));
    expect(dashboard.updateMemo).toHaveBeenCalledWith(entry.widgetId, "# 이전 모바일 메모");
  });
});
