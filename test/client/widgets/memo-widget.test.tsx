import { render, screen, waitFor } from "@testing-library/react";
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
