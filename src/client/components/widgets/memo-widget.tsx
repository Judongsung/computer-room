import { XpTabs } from "@client/components/shared/xp-tabs";
import { ProgramStatusBar } from "@client/components/desktop/application/program-status-bar";
import { PROGRAM_DOCUMENT_COPY as COPY } from "@client/content/ko/desktop/program-documents";
import { useMemo, useState } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { MemoWidget as MemoWidgetData } from "@/types/widgets/widget";
import { MEMO_WIDGET_COPY } from "@client/content/ko/widgets/content";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import { MEMO_EDITOR_MODE } from "@client/constants/widgets/memo";
import { XP_WIDGET_TOOLBAR_ACTION } from "@client/constants/shared/xp";
import { useUnsavedChangesWarning } from "@client/hooks/shared/use-unsaved-changes-warning";
import { useMemoEditor } from "@client/hooks/widgets/memo/use-memo-editor";
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
  const [editorMode, setEditorMode] = useState<
    (typeof MEMO_EDITOR_MODE)[keyof typeof MEMO_EDITOR_MODE]
  >(MEMO_EDITOR_MODE.WRITE);
  const scope = useMemo(() => ({}), [gateway, widget.id]);
  const editor = useMemoEditor({
    scope,
    markdown: widget.data.markdown,
    onSave: (draft) => gateway.updateMemo(widget.id, draft),
    onSaved: (data) => onWidgetChange({ ...widget, data }),
  });

  useUnsavedChangesWarning(editor.dirty);

  return (
    <WidgetCard
      className="desktop-program desktop-program--memo"
      bodyClassName="desktop-program-body"
      footer={<ProgramStatusBar
        primary={editor.editing ? COPY.EDITING : COPY.READING}
        secondary={editor.saving ? COPY.SAVING : editor.dirty ? COPY.CHANGED : COPY.MARKDOWN}
      />}
      title={widget.file?.name ?? MEMO_WIDGET_COPY.UNSAVED_TITLE}
      iconPath={WIDGET_ICON_PATH_BY_TYPE[WIDGET_TYPE.MEMO]}
      windowControls={windowControls}
      toolbarActions={
        !editor.editing ? (
          <XpWidgetToolbarButton
            action={XP_WIDGET_TOOLBAR_ACTION.EDIT}
            label={MEMO_WIDGET_COPY.EDIT}
            onClick={() => {
              setEditorMode(MEMO_EDITOR_MODE.WRITE);
              editor.beginEditing();
            }}
          />
        ) : null
      }
    >
      {editor.editing ? (
        <div className="memo-editor">
          <XpTabs
            className="desktop-memo-tabs"
            ariaLabel={MEMO_WIDGET_COPY.TABS_LABEL}
            activeTab={editorMode}
            onChange={setEditorMode}
            tabs={[
              { id: MEMO_EDITOR_MODE.WRITE, label: MEMO_WIDGET_COPY.WRITE,
                disabled: editor.saving, panel: <textarea
                  className="desktop-memo-input"
                  aria-label={MEMO_WIDGET_COPY.EDITOR_LABEL}
                  value={editor.draft}
                  onChange={(event) => editor.setDraft(event.currentTarget.value)}
                  disabled={editor.saving}
                /> },
              { id: MEMO_EDITOR_MODE.PREVIEW, label: MEMO_WIDGET_COPY.PREVIEW,
                disabled: editor.saving, panel: <div className="desktop-document-paper"><MarkdownContent markdown={editor.draft} /></div> },
            ]}
          />

          {editor.error ? (
            <p role="alert" className="widget-error">
              {editor.error}
            </p>
          ) : null}
          <div className="widget-form-actions">
            <button
              type="button"
              onClick={() => void editor.save()}
              disabled={editor.saving}
            >
              {editor.saving ? MEMO_WIDGET_COPY.SAVING : MEMO_WIDGET_COPY.SAVE}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                editor.cancel();
                setEditorMode(MEMO_EDITOR_MODE.WRITE);
              }}
              disabled={editor.saving}
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
