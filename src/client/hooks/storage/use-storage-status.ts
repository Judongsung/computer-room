import { STORAGE_STATUS_COPY } from "@client/content/ko/storage/storage-status";
import { messageFromError } from "@client/errors/error-message";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { StorageStatusSnapshot } from "@/types/storage/storage-status";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

interface StorageStatusSession {
  active: boolean;
  request: { promise: Promise<void> } | null;
}

interface StorageStatusState {
  readonly session: StorageStatusSession;
  readonly status: StorageStatusSnapshot | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export function useStorageStatus(gateway: StorageStatusGateway) {
  const session = useMemo<StorageStatusSession>(
    () => ({ active: false, request: null }),
    [gateway],
  );
  const initial = (): StorageStatusState => ({
    session,
    status: null,
    loading: true,
    error: null,
  });
  const [state, setState] = useState<StorageStatusState>(initial);
  const current = state.session === session ? state : initial();

  useLayoutEffect(() => {
    session.active = true;
    setState(initial());
    return () => {
      session.active = false;
      session.request = null;
    };
  }, [session]);

  const update = useCallback((patch: Partial<Omit<StorageStatusState, "session">>) => {
    setState((value) => ({
      ...(value.session === session ? value : initial()),
      ...patch,
    }));
  }, [session]);

  const refresh = useCallback((): Promise<void> => {
    if (!session.active) return Promise.resolve();
    if (session.request) return session.request.promise;
    update({ loading: true });
    const request = { promise: Promise.resolve() };
    session.request = request;
    request.promise = (async () => {
      try {
        const status = await gateway.getStatus();
        if (session.active && session.request === request) {
          update({ status, error: null });
        }
      } catch (reason) {
        if (session.active && session.request === request) {
          update({ error: messageFromError(reason, STORAGE_STATUS_COPY.LOAD_FAILED) });
        }
      } finally {
        if (session.active && session.request === request) {
          session.request = null;
          update({ loading: false });
        }
      }
    })();
    return request.promise;
  }, [gateway, session, update]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status: current.status,
    loading: current.loading,
    error: current.error,
    refresh,
  } as const;
}
