import { MEMO_WIDGET_COPY } from "@client/content/ko/widgets/content";
import { messageFromError } from "@client/errors/error-message";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

interface MemoEditorOptions<TResult> {
  readonly scope: object;
  readonly markdown: string;
  readonly startEditing?: boolean;
  readonly onSave: (draft: string) => Promise<TResult>;
  readonly onSaved?: (result: Exclude<TResult, false>) => void;
}

interface MemoEditorSession {
  readonly scope: object;
  active: boolean;
  pending: object | null;
}

interface MemoEditorState {
  readonly session: MemoEditorSession;
  readonly editing: boolean;
  readonly draft: string;
  readonly saving: boolean;
  readonly error: string | null;
}

function initialState(session: MemoEditorSession, markdown: string, editing: boolean): MemoEditorState {
  return { session, editing, draft: markdown, saving: false, error: null };
}

export function useMemoEditor<TResult>({
  scope,
  markdown,
  startEditing = false,
  onSave,
  onSaved,
}: MemoEditorOptions<TResult>) {
  const handlers = useRef({ markdown, startEditing, onSave, onSaved });
  const session = useMemo<MemoEditorSession>(
    () => ({ scope, active: false, pending: null }),
    [scope],
  );
  const [state, setState] = useState(() => initialState(session, markdown, startEditing));
  const current = state.session === session ? state : initialState(session, markdown, startEditing);

  useLayoutEffect(() => {
    handlers.current = { markdown, startEditing, onSave, onSaved };
  });
  useLayoutEffect(() => {
    session.active = true;
    setState(initialState(session, handlers.current.markdown, handlers.current.startEditing));
    return () => {
      session.active = false;
      session.pending = null;
    };
  }, [session]);

  const update = useCallback((patch: Partial<Omit<MemoEditorState, "session">>) => {
    setState((value) => ({
      ...(value.session === session ? value : initialState(session, handlers.current.markdown, handlers.current.startEditing)),
      ...patch,
    }));
  }, [session]);

  useEffect(() => {
    if (!current.editing) update({ draft: markdown });
  }, [current.editing, markdown, update]);

  const beginEditing = useCallback((): void => {
    if (!session.active || session.pending) return;
    update({ editing: true, draft: handlers.current.markdown, error: null });
  }, [session, update]);

  const setDraft = useCallback((draft: string): void => {
    if (!session.active || session.pending) return;
    update({ draft });
  }, [session, update]);

  const cancel = useCallback((): void => {
    if (!session.active || session.pending) return;
    update({
      editing: false,
      draft: handlers.current.markdown,
      error: null,
    });
  }, [session, update]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!session.active || session.pending) return false;
    const token = {};
    const draft = current.draft;
    session.pending = token;
    update({ saving: true, error: null });
    const isCurrent = () => session.active && session.pending === token;
    try {
      const result = await handlers.current.onSave(draft);
      if (!isCurrent() || result === false) return false;
      handlers.current.onSaved?.(result as Exclude<TResult, false>);
      update({ editing: false });
      return true;
    } catch (reason) {
      if (isCurrent()) {
        update({ error: messageFromError(reason, MEMO_WIDGET_COPY.SAVE_FAILED) });
      }
      return false;
    } finally {
      if (isCurrent()) {
        session.pending = null;
        update({ saving: false });
      }
    }
  }, [current.draft, session, update]);

  return {
    editing: current.editing,
    draft: current.draft,
    dirty: current.editing && current.draft !== markdown,
    saving: current.saving,
    error: current.error,
    beginEditing,
    setDraft,
    cancel,
    save,
  } as const;
}
