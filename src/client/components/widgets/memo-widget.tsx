import { XpTabs } from "@client/components/shared/xp-tabs";
import { ProgramStatusBar } from "@client/components/desktop/application/program-status-bar";
import { PROGRAM_DOCUMENT_COPY as COPY } from "@client/content/ko/desktop/program-documents";
import { useEffect, useState } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { MemoWidget as MemoWidgetData } from "@/types/widgets/widget";
import { MEMO_WIDGET_COPY } from "@client/content/ko/widgets/content";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import { MEMO_EDITOR_MODE } from "@client/constants/widgets/memo";
import { messageFromError } from "@client/errors/error-message";
import { XP_WIDGET_TOOLBAR_ACTION } from "@client/constants/shared/xp";
import { useUnsavedChangesWarning } from "@client/hooks/shared/use-unsaved-changes-warning";
import type { WidgetWindowControls } from "@client/types/desktop/window";
import type { MemoGateway } from "@client/types/widgets/ports/memo";
import { XpWidgetToolbarButton } from "@client/components/shared/xp-widget-toolbar-button";
import { WidgetCard } from "@client/components/widgets/widget-card";
import { MarkdownContent } from "@client/components/widgets/markdown-content";
import { ReadOnlyMemoContent } from "@client/components/widgets/read-only-program-content";

export interface MemoWidgetProps {
  readonly widget: MemoWidgetData;
  readonly windowControls: WidgetWindowControls;
  readonly gateway: MemoGateway;
  readonly onWidgetChange: (widget: MemoWidgetData) => void;
}

export function MemoWidget({
  widget,
  windowControls,
  gateway,
  onWidgetChange,
}: MemoWidgetProps) {
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editorMode, setEditorMode] = useState<
    (typeof MEMO_EDITOR_MODE)[keyof typeof MEMO_EDITOR_MODE]
  >(MEMO_EDITOR_MODE.WRITE);
  const [draft, setDraft] = useState(widget.data.markdown);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError(messageFromError(saveError, MEMO_WIDGET_COPY.SAVE_FAILED));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <WidgetCard
      className="desktop-program desktop-program--memo"
      bodyClassName="desktop-program-body"
      footer={<ProgramStatusBar
        primary={isEditingContent ? COPY.EDITING : COPY.READING}
        secondary={isSaving ? COPY.SAVING : isDirty ? COPY.CHANGED : COPY.MARKDOWN}
      />}
      title={widget.file?.name ?? MEMO_WIDGET_COPY.UNSAVED_TITLE}
      iconPath={WIDGET_ICON_PATH_BY_TYPE[WIDGET_TYPE.MEMO]}
      windowControls={windowControls}
      toolbarActions={
        !isEditingContent ? (
          <XpWidgetToolbarButton
            action={XP_WIDGET_TOOLBAR_ACTION.EDIT}
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
          <XpTabs
            className="desktop-memo-tabs"
            ariaLabel={MEMO_WIDGET_COPY.TABS_LABEL}
            activeTab={editorMode}
            onChange={setEditorMode}
            tabs={[
              { id: MEMO_EDITOR_MODE.WRITE, label: MEMO_WIDGET_COPY.WRITE,
                disabled: isSaving, panel: <textarea
                  className="desktop-memo-input"
                  aria-label={MEMO_WIDGET_COPY.EDITOR_LABEL}
                  value={draft}
                  onChange={(event) => setDraft(event.currentTarget.value)}
                  disabled={isSaving}
                /> },
              { id: MEMO_EDITOR_MODE.PREVIEW, label: MEMO_WIDGET_COPY.PREVIEW,
                disabled: isSaving, panel: <div className="desktop-document-paper"><MarkdownContent markdown={draft} /></div> },
            ]}
          />

          {error ? (
            <p role="alert" className="widget-error">
              {error}
            </p>
          ) : null}
          <div className="widget-form-actions">
            <button
              type="button"
              onClick={() => void save()}
              disabled={isSaving}
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
              disabled={isSaving}
            >
              {MEMO_WIDGET_COPY.CANCEL}
            </button>
          </div>
        </div>
      ) : (
        <div className="desktop-document-paper"><ReadOnlyMemoContent markdown={widget.data.markdown} /></div>
      )}
    </WidgetCard>
  );
}
