import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useCallback, useEffect, useState } from "react";
import {
  LOCAL_WIDGET_DRAFT_ID_PREFIX,
  LOCAL_WIDGET_DRAFT_STORAGE_KEY,
  LOCAL_WIDGET_DRAFT_VERSION,
} from "@client/constants/widgets/local-widget-draft";
import {
  createLocalWidgetDraft,
  parseLocalWidgetDraft,
  resetLocalChecklistForKoreaDate,
} from "@client/domain/widgets/local-widget-draft";
import type {
  LocalWidgetDraft,
  LocalWidgetDraftState,
} from "@client/types/widgets/local-widget-draft";
import type { WidgetFileType } from "@/types/widgets/widget-file";

export function useLocalWidgetDraft() {
  const [state, setState] = useState<LocalWidgetDraftState>(readDraft);

  useEffect(() => {
    const refreshDate = (): void => {
      if (!state.draft) return;
      const reset = resetLocalChecklistForKoreaDate(state.draft, Date.now());
      if (reset === state.draft) return;
      persistDraft(reset, setState);
    };
    window.addEventListener("focus", refreshDate);
    document.addEventListener("visibilitychange", refreshDate);
    return () => {
      window.removeEventListener("focus", refreshDate);
      document.removeEventListener("visibilitychange", refreshDate);
    };
  }, [state.draft]);

  const create = useCallback((type: WidgetFileType): boolean => {
    if (state.draft) return false;
    const now = Date.now();
    const draft = createLocalWidgetDraft(
      type,
      `${LOCAL_WIDGET_DRAFT_ID_PREFIX}-${crypto.randomUUID()}`,
      now,
    );
    const created = writeDraft(draft);
    setState(
      created
        ? { draft, error: null }
        : { draft: null, error: MOBILE_COPY.DRAFT_STORAGE_FAILED },
    );
    return created;
  }, [state.draft]);

  const save = useCallback((draft: LocalWidgetDraft): boolean => {
    const updated = { ...draft, updatedAt: new Date().toISOString() };
    if (!writeDraft(updated)) {
      setState((current) => ({
        ...current,
        error: MOBILE_COPY.DRAFT_STORAGE_FAILED,
      }));
      return false;
    }
    setState({ draft: updated, error: null });
    return true;
  }, []);

  const remove = useCallback((): void => {
    try {
      window.localStorage.removeItem(LOCAL_WIDGET_DRAFT_STORAGE_KEY);
      setState({ draft: null, error: null });
    } catch {
      setState((current) => ({
        ...current,
        error: MOBILE_COPY.DRAFT_STORAGE_FAILED,
      }));
    }
  }, []);

  const clearError = useCallback(
    () => setState((current) => ({ ...current, error: null })),
    [],
  );

  return { ...state, create, save, remove, clearError };
}

function readDraft(): LocalWidgetDraftState {
  try {
    const raw = window.localStorage.getItem(LOCAL_WIDGET_DRAFT_STORAGE_KEY);
    if (raw === null) return { draft: null, error: null };
    const parsed = parseLocalWidgetDraft(JSON.parse(raw) as unknown);
    if (!parsed) {
      window.localStorage.removeItem(LOCAL_WIDGET_DRAFT_STORAGE_KEY);
      return { draft: null, error: MOBILE_COPY.DRAFT_CORRUPTED };
    }
    const draft = resetLocalChecklistForKoreaDate(parsed, Date.now());
    if (draft !== parsed && !writeDraft(draft)) {
      return { draft: parsed, error: MOBILE_COPY.DRAFT_STORAGE_FAILED };
    }
    return { draft, error: null };
  } catch {
    return { draft: null, error: MOBILE_COPY.DRAFT_STORAGE_FAILED };
  }
}

function persistDraft(
  draft: LocalWidgetDraft,
  setState: (state: LocalWidgetDraftState) => void,
): void {
  setState(
    writeDraft(draft)
      ? { draft, error: null }
      : { draft, error: MOBILE_COPY.DRAFT_STORAGE_FAILED },
  );
}

function writeDraft(draft: LocalWidgetDraft): boolean {
  try {
    window.localStorage.setItem(
      LOCAL_WIDGET_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    );
    return true;
  } catch {
    return false;
  }
}
