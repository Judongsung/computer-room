import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useEffect, useRef, useState } from "react";
import { MarkdownContent } from "@client/components/widgets/markdown-content";
import { ReadOnlyMemoContent } from "@client/components/widgets/read-only-program-content";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { MEMO_WIDGET_COPY } from "@client/content/ko/widgets/content";
import { useUnsavedChangesWarning } from "@client/hooks/shared/use-unsaved-changes-warning";
import { useMemoEditor } from "@client/hooks/widgets/memo/use-memo-editor";
import { MobileMemoHistoryDialog } from "@client/components/mobile/widgets/mobile-memo-history-dialog";
import { MEMO_HISTORY_COPY } from "@client/content/ko/widgets/memo-history";
import type { MemoHistoryGateway } from "@client/types/widgets/ports/memo";

interface MobileMemoHistoryConfig {
  readonly widgetId: string;
  readonly gateway: MemoHistoryGateway;
}

interface MobileMemoProps {
  readonly scope: object;
  readonly markdown: string;
  readonly startEditing?: boolean;
  readonly onSave: (markdown: string) => Promise<void | boolean>;
  readonly onRequestFileSave?: (markdown: string) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly history?: MobileMemoHistoryConfig;
}

export function MobileMemo({
  scope,
  markdown,
  startEditing = false,
  onSave,
  onRequestFileSave,
  onDirtyChange,
  history,
}: MobileMemoProps) {
  const [preview, setPreview] = useState(false);
  const [historyScope, setHistoryScope] = useState<
    { scope: object; widgetId: string; gateway: MemoHistoryGateway } | null
  >(null);
  const currentHistory = useRef({ scope, widgetId: history?.widgetId, gateway: history?.gateway });
  currentHistory.current = { scope, widgetId: history?.widgetId, gateway: history?.gateway };
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
          <>
            <button type="button" onClick={editor.beginEditing}>{MOBILE_COPY.EDIT}</button>
            {history ? (
              <button type="button" onClick={() => setHistoryScope({ scope, ...history })}>
                {MEMO_HISTORY_COPY.OPEN}
              </button>
            ) : null}
          </>
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
      {history && historyScope?.scope === scope && historyScope.widgetId === history.widgetId &&
        historyScope.gateway === history.gateway ? (
          <MobileMemoHistoryDialog
            widgetId={history.widgetId}
            gateway={history.gateway}
            onClose={() => setHistoryScope(null)}
            onLoadDraft={(draft) => {
              if (currentHistory.current.scope !== scope || currentHistory.current.widgetId !== history.widgetId ||
                currentHistory.current.gateway !== history.gateway) return false;
              const loaded = editor.loadDraft(draft);
              if (loaded) setPreview(false);
              return loaded;
            }}
          />
        ) : null}
    </div>
  );
}
