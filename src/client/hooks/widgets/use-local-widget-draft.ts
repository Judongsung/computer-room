import { useCallback, useEffect, useState } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { getKoreaDateContext } from "@/domain/shared/korea-date";
import {
  LOCAL_WIDGET_DRAFT_ID_PREFIX,
  LOCAL_WIDGET_DRAFT_STORAGE_KEY,
  LOCAL_WIDGET_DRAFT_VERSION,
} from "@client/constants/widgets/local-widget-draft";
import { MOBILE_COPY } from "@client/constants/shared/mobile";
import {
  parseLocalWidgetDraft,
  resetLocalChecklistForKoreaDate,
} from "@client/domain/widgets/local-widget-draft";
import type {
  LocalWidgetDraft,
  LocalWidgetDraftState,
} from "@client/types/widgets/local-widget-draft";

type DraftWidgetType =
  | typeof WIDGET_TYPE.MEMO
  | typeof WIDGET_TYPE.DAILY_CHECKLIST;

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

  const create = useCallback((type: DraftWidgetType): boolean => {
    if (state.draft) return false;
    const now = Date.now();
    const timestamp = new Date(now).toISOString();
    const base = {
      version: LOCAL_WIDGET_DRAFT_VERSION,
      id: `${LOCAL_WIDGET_DRAFT_ID_PREFIX}-${crypto.randomUUID()}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as const;
    const draft: LocalWidgetDraft =
      type === WIDGET_TYPE.MEMO
        ? { ...base, type, markdown: "" }
        : {
            ...base,
            type,
            businessDate: getKoreaDateContext(now).businessDate,
            items: [],
          };
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
