import { useEffect, useState } from "react";
import { MarkdownContent } from "@client/components/widgets/markdown-content";
import { MOBILE_CLASS_NAME, MOBILE_COPY } from "@client/constants/shared/mobile";
import { MEMO_WIDGET_COPY } from "@client/constants/widgets/content";
import { messageFromError } from "@client/errors/error-message";
import { useUnsavedChangesWarning } from "@client/hooks/shared/use-unsaved-changes-warning";

interface MobileMemoProps {
  readonly markdown: string;
  readonly startEditing?: boolean;
  readonly onSave: (markdown: string) => Promise<void>;
  readonly onRequestFileSave?: (markdown: string) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
}

export function MobileMemo({
  markdown,
  startEditing = false,
  onSave,
  onRequestFileSave,
  onDirtyChange,
}: MobileMemoProps) {
  const [editing, setEditing] = useState(startEditing);
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState(markdown);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = editing && draft !== markdown;
  useUnsavedChangesWarning(dirty);

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!editing) setDraft(markdown);
  }, [editing, markdown]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const save = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
      setPreview(false);
    } catch (caught) {
      setError(messageFromError(caught, MEMO_WIDGET_COPY.SAVE_FAILED));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={MOBILE_CLASS_NAME.WIDGET}>
      <div className={MOBILE_CLASS_NAME.TOOLBAR}>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)}>{MOBILE_COPY.EDIT}</button>
        ) : (
          <>
            <button type="button" disabled={saving} onClick={() => setPreview(false)}>
              {MEMO_WIDGET_COPY.WRITE}
            </button>
            <button type="button" disabled={saving} onClick={() => setPreview(true)}>
              {MEMO_WIDGET_COPY.PREVIEW}
            </button>
            <button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? MOBILE_COPY.SAVING : MOBILE_COPY.SAVE_LOCAL}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDraft(markdown);
                setEditing(false);
                setPreview(false);
                setError(null);
              }}
            >
              {MOBILE_COPY.DISCARD_CHANGES}
            </button>
          </>
        )}
        {onRequestFileSave ? (
          <button type="button" disabled={saving} onClick={() => onRequestFileSave(draft)}>
            {MOBILE_COPY.SAVE_AS_FILE}
          </button>
        ) : null}
      </div>
      {editing ? (
        preview ? (
          <MarkdownContent markdown={draft} />
        ) : (
          <textarea
            aria-label={MEMO_WIDGET_COPY.EDITOR_LABEL}
            value={draft}
            disabled={saving}
            onChange={(event) => setDraft(event.currentTarget.value)}
          />
        )
      ) : (
        <MarkdownContent markdown={markdown} />
      )}
      {error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{error}</p> : null}
    </div>
  );
}
