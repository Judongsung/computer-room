import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { WIDGET_TYPE } from "../../../constants/widget";
import type { MemoWidget as MemoWidgetData } from "../../../types/widget";
import { MEMO_WIDGET_COPY } from "../../constants/content";
import { LUNA_TITLE_BAR_ACTION } from "../../constants/luna";
import { MEMO_EDITOR_MODE } from "../../constants/memo";
import { useUnsavedChangesWarning } from "../../hooks/use-unsaved-changes-warning";
import { LunaTitleBarButton } from "../ui/luna-title-bar-button";
import type { WidgetComponentProps } from "./widget-renderer";
import { WidgetCard } from "./widget-card";

const MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks];

export function MemoWidget(props: WidgetComponentProps) {
  if (props.widget.type !== WIDGET_TYPE.MEMO) {
    return null;
  }
  return <MemoWidgetContent {...props} widget={props.widget} />;
}

type MemoWidgetContentProps = Omit<WidgetComponentProps, "widget"> & {
  readonly widget: MemoWidgetData;
};

function MemoWidgetContent({
  widget,
  isEditingLayout,
  onDelete,
  gateway,
  onWidgetChange,
}: MemoWidgetContentProps) {
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editorMode, setEditorMode] = useState<
    (typeof MEMO_EDITOR_MODE)[keyof typeof MEMO_EDITOR_MODE]
  >(MEMO_EDITOR_MODE.WRITE);
  const [draft, setDraft] = useState(widget.data.markdown);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writeTabId = useId();
  const previewTabId = useId();
  const editorPanelId = useId();
  const writeTabRef = useRef<HTMLButtonElement>(null);
  const previewTabRef = useRef<HTMLButtonElement>(null);
  const isDirty = isEditingContent && draft !== widget.data.markdown;

  useUnsavedChangesWarning(isDirty);

  useEffect(() => {
    if (!isEditingContent) {
      setDraft(widget.data.markdown);
    }
  }, [isEditingContent, widget.data.markdown]);

  const save = async (): Promise<void> => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const data = await gateway.updateMemo(widget.id, draft);
      onWidgetChange({ ...widget, data });
      setIsEditingContent(false);
    } catch (saveError) {
      setError(errorMessage(saveError, MEMO_WIDGET_COPY.SAVE_FAILED));
    } finally {
      setIsSaving(false);
    }
  };

  const selectTabWithKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
  ): void => {
    let nextMode: (typeof MEMO_EDITOR_MODE)[keyof typeof MEMO_EDITOR_MODE];
    if (event.key === "Home") {
      nextMode = MEMO_EDITOR_MODE.WRITE;
    } else if (event.key === "End") {
      nextMode = MEMO_EDITOR_MODE.PREVIEW;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      nextMode =
        editorMode === MEMO_EDITOR_MODE.WRITE
          ? MEMO_EDITOR_MODE.PREVIEW
          : MEMO_EDITOR_MODE.WRITE;
    } else {
      return;
    }

    event.preventDefault();
    setEditorMode(nextMode);
    const nextTab =
      nextMode === MEMO_EDITOR_MODE.WRITE ? writeTabRef : previewTabRef;
    nextTab.current?.focus();
  };

  return (
    <WidgetCard
      title={MEMO_WIDGET_COPY.TITLE}
      deleteLabel={MEMO_WIDGET_COPY.DELETE_LABEL}
      isEditingLayout={isEditingLayout}
        onDelete={onDelete}
        headerActions={
          !isEditingContent ? (
            <LunaTitleBarButton
              action={LUNA_TITLE_BAR_ACTION.EDIT}
              label={MEMO_WIDGET_COPY.EDIT}
              onClick={() => {
                setDraft(widget.data.markdown);
                setEditorMode(MEMO_EDITOR_MODE.WRITE);
                setError(null);
                setIsEditingContent(true);
              }}
            />
          ) : null
        }
    >
      {isEditingContent ? (
        <div className="memo-editor">
          <menu
            className="memo-editor__tabs"
            role="tablist"
            aria-label={MEMO_WIDGET_COPY.TABS_LABEL}
          >
            <button
              ref={writeTabRef}
              id={writeTabId}
              type="button"
              role="tab"
              aria-selected={editorMode === MEMO_EDITOR_MODE.WRITE}
              aria-controls={editorPanelId}
              tabIndex={editorMode === MEMO_EDITOR_MODE.WRITE ? 0 : -1}
              onClick={() => setEditorMode(MEMO_EDITOR_MODE.WRITE)}
              onKeyDown={selectTabWithKeyboard}
              disabled={isSaving || isEditingLayout}
            >
              {MEMO_WIDGET_COPY.WRITE}
            </button>
            <button
              ref={previewTabRef}
              id={previewTabId}
              type="button"
              role="tab"
              aria-selected={editorMode === MEMO_EDITOR_MODE.PREVIEW}
              aria-controls={editorPanelId}
              tabIndex={editorMode === MEMO_EDITOR_MODE.PREVIEW ? 0 : -1}
              onClick={() => setEditorMode(MEMO_EDITOR_MODE.PREVIEW)}
              onKeyDown={selectTabWithKeyboard}
              disabled={isSaving || isEditingLayout}
            >
              {MEMO_WIDGET_COPY.PREVIEW}
            </button>
          </menu>

          <div
            className="memo-editor__panel"
            id={editorPanelId}
            role="tabpanel"
            aria-labelledby={
              editorMode === MEMO_EDITOR_MODE.WRITE
                ? writeTabId
                : previewTabId
            }
          >
            {editorMode === MEMO_EDITOR_MODE.WRITE ? (
              <textarea
                className="memo-editor__textarea"
                aria-label={MEMO_WIDGET_COPY.EDITOR_LABEL}
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
                disabled={isSaving || isEditingLayout}
              />
            ) : (
              <MarkdownContent markdown={draft} />
            )}
          </div>

          {error ? (
            <p role="alert" className="widget-error">
              {error}
            </p>
          ) : null}
          <div className="widget-form-actions">
            <button
              type="button"
              onClick={() => void save()}
              disabled={isSaving || isEditingLayout}
            >
              {isSaving ? MEMO_WIDGET_COPY.SAVING : MEMO_WIDGET_COPY.SAVE}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setDraft(widget.data.markdown);
                setError(null);
                setIsEditingContent(false);
              }}
              disabled={isSaving || isEditingLayout}
            >
              {MEMO_WIDGET_COPY.CANCEL}
            </button>
          </div>
        </div>
      ) : (
        <MarkdownContent markdown={widget.data.markdown} />
      )}
    </WidgetCard>
  );
}

function MarkdownContent({ markdown }: { readonly markdown: string }) {
  if (markdown.length === 0) {
    return <p className="widget-empty">{MEMO_WIDGET_COPY.EMPTY_CONTENT}</p>;
  }
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>{markdown}</ReactMarkdown>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
