import { useState } from "react";
import type { MemoWidget as MemoWidgetData } from "@/types/widgets/widget";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { MemoWidget } from "@client/components/widgets/memo-widget";
import { MEMO_WIDGET_COPY as COPY } from "@client/content/ko/widgets/content";
import { memoWidget } from "@test/support/widgets/dashboard-fixtures";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { MemoGateway } from "@client/types/widgets/ports/memo";
import { deferred } from "@test/support/widgets/deferred";
import { MEMO_HISTORY_COPY } from "@client/content/ko/widgets/memo-history";

it("previews a saved version and loads it as an unsaved draft", async () => {
  const widget = memoWidget("memo-history");
  if (widget.type !== WIDGET_TYPE.MEMO) throw new Error("memo fixture required");
  const gateway: MemoGateway = {
    updateMemo: vi.fn(async (_id, markdown) => ({ markdown, updatedAt: null })),
    listMemoVersions: vi.fn(async () => ({ items: [{ version: 3, savedAt: null }] })),
    getMemoVersion: vi.fn(async () => ({ version: 3, savedAt: null, markdown: "# 이전 내용" })),
  };
  const onWidgetChange = vi.fn();
  const controls = { isActive: true, isMaximized: false, canSaveFile: false,
    onFocus: vi.fn(), onMinimize: vi.fn(), onToggleMaximize: vi.fn(), onClose: vi.fn(), onSaveFile: vi.fn() };
  const user = userEvent.setup();
  render(<MemoWidget widget={widget} gateway={gateway} onWidgetChange={onWidgetChange}
    windowControls={controls} />);
  await user.click(screen.getByRole("button", { name: MEMO_HISTORY_COPY.OPEN }));
  expect(await screen.findByRole("dialog", { name: MEMO_HISTORY_COPY.TITLE })).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "이전 내용" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: MEMO_HISTORY_COPY.LOAD_DRAFT }));
  expect(screen.queryByRole("dialog", { name: MEMO_HISTORY_COPY.TITLE })).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: COPY.EDITOR_LABEL })).toHaveValue("# 이전 내용");
  expect(gateway.updateMemo).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: MEMO_HISTORY_COPY.OPEN })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: COPY.CANCEL }));
  expect(screen.getByRole("button", { name: MEMO_HISTORY_COPY.OPEN })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: MEMO_HISTORY_COPY.OPEN }));
  await user.click(await screen.findByRole("button", { name: MEMO_HISTORY_COPY.LOAD_DRAFT }));
  await user.click(screen.getByRole("button", { name: COPY.SAVE }));
  await waitFor(() => expect(gateway.updateMemo).toHaveBeenCalledWith(widget.id, "# 이전 내용"));
});

it("saves a memo with only its own gateway and window controls", async () => {
  const widget = memoWidget("memo");
  if (widget.type !== WIDGET_TYPE.MEMO) throw new Error("memo fixture required");
  const gateway = { updateMemo: vi.fn(async (_id: string, markdown: string) => ({ markdown, updatedAt: null })),
    listMemoVersions: vi.fn(async () => ({ items: [] })),
    getMemoVersion: vi.fn(async (_id: string, version: number) => ({ version, savedAt: null, markdown: "" })) } satisfies MemoGateway;
  const onWidgetChange = vi.fn();
  const user = userEvent.setup();
  render(<MemoWidget widget={widget} gateway={gateway} onWidgetChange={onWidgetChange}
    windowControls={{ isActive: true, isMaximized: false, canSaveFile: false,
      onFocus: vi.fn(), onMinimize: vi.fn(), onToggleMaximize: vi.fn(), onClose: vi.fn(), onSaveFile: vi.fn() }} />);
  await user.click(screen.getByRole("button", { name: COPY.EDIT }));
  await user.type(screen.getByRole("textbox", { name: COPY.EDITOR_LABEL }), "saved memo");
  await user.click(screen.getByRole("button", { name: COPY.SAVE }));
  await waitFor(() => expect(onWidgetChange).toHaveBeenCalledWith({ ...widget, data: { markdown: "saved memo", updatedAt: null } }));
  expect(gateway.updateMemo).toHaveBeenCalledWith(widget.id, "saved memo");
});

it("applies a delayed save to the latest memo metadata", async () => {
  const widget = memoWidget("memo-latest");
  if (widget.type !== WIDGET_TYPE.MEMO) throw new Error("memo fixture required");
  if (!widget.file) throw new Error("stored memo fixture required");
  const pending = deferred<{ markdown: string; updatedAt: string | null }>();
  const gateway = { updateMemo: vi.fn(() => pending.promise),
    listMemoVersions: vi.fn(async () => ({ items: [] })),
    getMemoVersion: vi.fn(async (_id: string, version: number) => ({ version, savedAt: null, markdown: "" })) } satisfies MemoGateway;
  const onWidgetChange = vi.fn();
  const user = userEvent.setup();
  const windowControls = { isActive: true, isMaximized: false, canSaveFile: false,
    onFocus: vi.fn(), onMinimize: vi.fn(), onToggleMaximize: vi.fn(), onClose: vi.fn(), onSaveFile: vi.fn() };
  const { rerender } = render(
    <MemoWidget widget={widget} gateway={gateway} onWidgetChange={onWidgetChange}
      windowControls={windowControls} />,
  );
  await user.click(screen.getByRole("button", { name: COPY.EDIT }));
  await user.type(screen.getByRole("textbox", { name: COPY.EDITOR_LABEL }), "saved");
  await user.click(screen.getByRole("button", { name: COPY.SAVE }));
  const latest = {
    ...widget,
    position: { x: 240, y: 120 },
    file: { ...widget.file, name: "renamed" },
  };
  rerender(
    <MemoWidget widget={latest} gateway={gateway} onWidgetChange={onWidgetChange}
      windowControls={windowControls} />,
  );
  await pending.resolve({ markdown: "saved", updatedAt: null });
  await waitFor(() => expect(onWidgetChange).toHaveBeenCalledWith({
    ...latest,
    data: { markdown: "saved", updatedAt: null },
  }));
});

  it("preserves a memo draft across keyboard preview navigation and cancels edits", async () => {
    renderMemoEditor();
    const user = userEvent.setup();
    await screen.findByText(COPY.EMPTY_CONTENT);
    await user.click(screen.getByRole("button", { name: COPY.EDIT }));
    await user.type(screen.getByRole("textbox", { name: COPY.EDITOR_LABEL }), "# 초안 제목");
    const editor = screen.getByRole<HTMLTextAreaElement>("textbox", { name: COPY.EDITOR_LABEL });
    await user.keyboard("{Control>}a{/Control}");
    expect(editor.selectionStart).toBe(0);
    expect(editor.selectionEnd).toBe(editor.value.length);
    expect(fireEvent.keyDown(editor, { key: "a", metaKey: true })).toBe(true);
    await user.click(screen.getByRole("tab", { name: COPY.WRITE }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: COPY.PREVIEW })).toHaveFocus();
    expect(screen.getByRole("heading", { name: "초안 제목" })).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("textbox", { name: COPY.EDITOR_LABEL })).toHaveValue("# 초안 제목");
    await user.click(screen.getByRole("button", { name: COPY.CANCEL }));
    expect(screen.getAllByText(COPY.EMPTY_CONTENT)).toHaveLength(1);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });


  it("edits and renders a memo with GFM markdown", async () => {
    const api = renderMemoEditor();
    const user = userEvent.setup();
    const markdown =
      "# 오늘\n\n**중요**\n다음 줄\n\n~~완료~~\n\n- [x] 확인\n\n<script>alert('x')</script>";

    await user.click(
      screen.getByRole("button", { name: COPY.EDIT }),
    );
    const writeTab = screen.getByRole("tab", { name: COPY.WRITE });
    const previewTab = screen.getByRole("tab", {
      name: COPY.PREVIEW,
    });
    writeTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(previewTab).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    const editor = screen.getByRole("textbox", {
      name: COPY.EDITOR_LABEL,
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
      screen.getByRole("button", { name: COPY.SAVE }),
    );
    await waitFor(() =>
      expect(
        api.savedWidgets[0]?.type === WIDGET_TYPE.MEMO
          ? api.savedWidgets[0].data.markdown
          : null,
      ).toBe(markdown),
    );
  });


function renderMemoEditor() {
  const widget = memoWidget("memo-editor");
  if (widget.type !== WIDGET_TYPE.MEMO) throw new Error("memo fixture required");
  const initial: MemoWidgetData = widget;
  const gateway = new FakeDashboardGateway();
  gateway.savedWidgets = [widget];
  function Editor() {
    const [current, setCurrent] = useState(initial);
    return <MemoWidget widget={current} gateway={gateway} onWidgetChange={setCurrent}
      windowControls={{ isActive: true, isMaximized: false, canSaveFile: false,
        onFocus: vi.fn(), onMinimize: vi.fn(), onToggleMaximize: vi.fn(), onClose: vi.fn(), onSaveFile: vi.fn() }} />;
  }
  render(<Editor />);
  return gateway;
}
