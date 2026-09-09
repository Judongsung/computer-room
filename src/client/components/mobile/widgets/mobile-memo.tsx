import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useEffect, useState } from "react";
import { MarkdownContent } from "@client/components/widgets/markdown-content";
import { ReadOnlyMemoContent } from "@client/components/widgets/read-only-program-content";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { MEMO_WIDGET_COPY } from "@client/content/ko/widgets/content";
import { useUnsavedChangesWarning } from "@client/hooks/shared/use-unsaved-changes-warning";
import { useMemoEditor } from "@client/hooks/widgets/memo/use-memo-editor";

interface MobileMemoProps {
  readonly scope: object;
  readonly markdown: string;
  readonly startEditing?: boolean;
  readonly onSave: (markdown: string) => Promise<void | boolean>;
  readonly onRequestFileSave?: (markdown: string) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
}

export function MobileMemo({
  scope,
  markdown,
  startEditing = false,
  onSave,
  onRequestFileSave,
  onDirtyChange,
}: MobileMemoProps) {
  const [preview, setPreview] = useState(false);
  const editor = useMemoEditor({ scope, markdown, startEditing, onSave });
  useUnsavedChangesWarning(editor.dirty);

  useEffect(() => onDirtyChange?.(editor.dirty), [editor.dirty, onDirtyChange]);
  useEffect(() => {
    if (!editor.editing) setPreview(false);
  }, [editor.editing]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  return (
    <div className={MOBILE_CLASS_NAME.WIDGET}>
      <div className={MOBILE_CLASS_NAME.TOOLBAR}>
        {!editor.editing ? (
          <button type="button" onClick={editor.beginEditing}>{MOBILE_COPY.EDIT}</button>
        ) : (
          <>
            <button type="button" disabled={editor.saving} onClick={() => setPreview(false)}>
              {MEMO_WIDGET_COPY.WRITE}
            </button>
            <button type="button" disabled={editor.saving} onClick={() => setPreview(true)}>
              {MEMO_WIDGET_COPY.PREVIEW}
            </button>
            <button type="button" disabled={editor.saving} onClick={() => void editor.save()}>
              {editor.saving ? MOBILE_COPY.SAVING : MOBILE_COPY.SAVE_LOCAL}
            </button>
            <button
              type="button"
              disabled={editor.saving}
              onClick={() => {
                editor.cancel();
                setPreview(false);
              }}
            >
              {MOBILE_COPY.DISCARD_CHANGES}
            </button>
          </>
        )}
        {onRequestFileSave ? (
          <button type="button" disabled={editor.saving} onClick={() => onRequestFileSave(editor.draft)}>
            {MOBILE_COPY.SAVE_AS_FILE}
          </button>
        ) : null}
      </div>
      {editor.editing ? (
        preview ? (
          <MarkdownContent markdown={editor.draft} />
        ) : (
          <textarea
            aria-label={MEMO_WIDGET_COPY.EDITOR_LABEL}
            value={editor.draft}
            disabled={editor.saving}
            onChange={(event) => editor.setDraft(event.currentTarget.value)}
          />
        )
      ) : (
        <ReadOnlyMemoContent markdown={markdown} />
      )}
      {editor.error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{editor.error}</p> : null}
    </div>
  );
}
