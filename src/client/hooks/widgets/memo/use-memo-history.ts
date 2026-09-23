import { useCallback, useEffect, useMemo, useState } from "react";
import type { MemoVersion, MemoVersionSummary } from "@/types/widgets/memo";
import { MEMO_ERRORS } from "@/constants/widgets/errors/memo";
import { MEMO_HISTORY_COPY } from "@client/content/ko/widgets/memo-history";
import { ApiError } from "@client/errors/api-error";
import { messageFromError } from "@client/errors/error-message";
import type { MemoHistoryGateway } from "@client/types/widgets/ports/memo";

interface HistorySession {
  widgetId: string;
  gateway: MemoHistoryGateway;
  active: boolean;
  listRequest: number;
  detailRequest: number;
  listPending: boolean;
  detailPendingVersion: number | null;
}

interface HistoryState {
  session: HistorySession;
  items: readonly MemoVersionSummary[];
  listLoading: boolean;
  listError: string | null;
  selectedVersion: number | null;
  detail: MemoVersion | null;
  detailLoading: boolean;
  detailError: string | null;
  expired: boolean;
}

function initialState(session: HistorySession): HistoryState {
  return { session, items: [], listLoading: true, listError: null,
    selectedVersion: null, detail: null, detailLoading: false, detailError: null, expired: false };
}

export function useMemoHistory(widgetId: string, gateway: MemoHistoryGateway) {
  const session = useMemo<HistorySession>(() => ({ widgetId, gateway, active: false, listRequest: 0, detailRequest: 0,
    listPending: false, detailPendingVersion: null }), [widgetId, gateway]);
  const [state, setState] = useState(() => initialState(session));
  const current = state.session === session ? state : initialState(session);
  const update = useCallback((patch: Partial<HistoryState>) => {
    setState((previous) => ({ ...(previous.session === session ? previous : initialState(session)), ...patch }));
  }, [session]);

  const select = useCallback((version: number) => {
    if (!session.active) return;
    if (session.detailPendingVersion === version) return;
    const request = ++session.detailRequest;
    session.detailPendingVersion = version;
    update({ selectedVersion: version, detail: null, detailLoading: true, detailError: null, expired: false });
    void session.gateway.getMemoVersion(session.widgetId, version).then(
      (detail) => {
        if (session.active && session.detailRequest === request) {
          session.detailPendingVersion = null;
          update(detail.version === version
            ? { detail, detailLoading: false }
            : { detailLoading: false, detailError: MEMO_HISTORY_COPY.DETAIL_FAILED });
        }
      },
      (error: unknown) => {
        if (session.active && session.detailRequest === request) {
          session.detailPendingVersion = null;
          const expired = error instanceof ApiError && error.code === MEMO_ERRORS.VERSION_NOT_FOUND.code;
          update({ detailLoading: false, expired, detailError: expired
            ? MEMO_HISTORY_COPY.EXPIRED : messageFromError(error, MEMO_HISTORY_COPY.DETAIL_FAILED) });
        }
      },
    );
  }, [session, update]);

  const reloadList = useCallback(() => {
    if (!session.active) return;
    if (session.listPending) return;
    const request = ++session.listRequest;
    session.listPending = true;
    ++session.detailRequest;
    session.detailPendingVersion = null;
    update({ items: [], listLoading: true, listError: null, selectedVersion: null,
      detail: null, detailLoading: false, detailError: null, expired: false });
    void session.gateway.listMemoVersions(session.widgetId).then(
      (page) => {
        if (!session.active || session.listRequest !== request) return;
        session.listPending = false;
        update({ items: page.items, listLoading: false });
        if (page.items.length > 0) select(page.items[0]!.version);
      },
      (error: unknown) => {
        if (session.active && session.listRequest === request) {
          session.listPending = false;
          update({ listLoading: false, listError: messageFromError(error, MEMO_HISTORY_COPY.LIST_FAILED) });
        }
      },
    );
  }, [select, session, update]);

  useEffect(() => {
    session.active = true;
    reloadList();
    return () => {
      session.active = false;
      ++session.listRequest;
      ++session.detailRequest;
      session.listPending = false;
      session.detailPendingVersion = null;
    };
  }, [reloadList, session]);

  const retryDetail = useCallback(() => {
    if (current.selectedVersion !== null && !current.expired) select(current.selectedVersion);
  }, [current.expired, current.selectedVersion, select]);

  return { ...current, select, reloadList, retryDetail };
}
