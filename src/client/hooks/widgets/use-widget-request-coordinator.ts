import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

interface RequestOptions<T> {
  readonly scope: object;
  readonly read: () => Promise<T>;
  readonly onRead: (value: T) => void;
}

interface MutationOptions<T> {
  readonly operation: () => Promise<T>;
  readonly onStart?: () => void;
  readonly onSuccess: (value: T) => void;
  readonly onError?: (reason: unknown) => void;
}

interface RequestState {
  readonly reading: boolean;
  readonly mutating: boolean;
  readonly readError: { readonly cause: unknown } | null;
  readonly mutationError: { readonly cause: unknown } | null;
}

interface ReadRequest {
  promise: Promise<void>;
}

const IDLE: RequestState = {
  reading: false, mutating: false, readError: null, mutationError: null,
};

export function useWidgetRequestCoordinator<T>(options: RequestOptions<T>) {
  const { scope } = options;
  const handlers = useRef(options);
  // Tokens belong to one screen/gateway lifetime; old network requests may still finish.
  const session = useMemo(() => ({
    scope,
    active: false,
    read: null as ReadRequest | null,
    mutation: null as object | null,
    refreshPending: false,
  }), [scope]);
  const [state, setState] = useState({ session, ...IDLE });

  useLayoutEffect(() => { handlers.current = options; });
  useLayoutEffect(() => {
    session.active = true;
    setState({ session, ...IDLE });
    return () => {
      session.active = false;
      session.read = null;
      session.mutation = null;
      session.refreshPending = false;
    };
  }, [session]);

  const update = useCallback((patch: Partial<RequestState>) => {
    setState((current) => ({
      ...(current.session === session ? current : { session, ...IDLE }),
      ...patch,
    }));
  }, [session]);

  const refresh = useCallback((): Promise<void> => {
    if (!session.active) return Promise.resolve();
    if (session.mutation) {
      session.refreshPending = true;
      return Promise.resolve();
    }
    if (session.read) return session.read.promise;
    const request: ReadRequest = { promise: Promise.resolve() };
    session.read = request;
    update({ reading: true, readError: null });
    const current = () => session.active && session.read === request;
    const read = handlers.current.read;
    request.promise = (async () => {
      try {
        const value = await read();
        if (current()) handlers.current.onRead(value);
      } catch (cause) {
        if (current()) update({ readError: { cause } });
      } finally {
        if (current()) {
          session.read = null;
          update({ reading: false });
        }
      }
    })();
    return request.promise;
  }, [session, update]);

  const mutate = useCallback(async <TResult,>(
    mutation: MutationOptions<TResult>,
  ): Promise<boolean> => {
    if (!session.active || session.mutation) return false;
    const token = {};
    session.mutation = token;
    if (session.read) {
      // Release the logical read immediately so the queued refresh need not wait for it.
      session.read = null;
      session.refreshPending = true;
    }
    update({ reading: false, mutating: true, mutationError: null });
    const current = () => session.active && session.mutation === token;
    try {
      mutation.onStart?.();
      const value = await mutation.operation();
      if (!current()) return false;
      mutation.onSuccess(value);
      return true;
    } catch (cause) {
      if (current()) {
        mutation.onError?.(cause);
        update({ mutationError: { cause } });
      }
      return false;
    } finally {
      if (current()) {
        session.mutation = null;
        update({ mutating: false });
        if (session.refreshPending) {
          session.refreshPending = false;
          void refresh();
        }
      }
    }
  }, [refresh, session, update]);

  const isMutating = useCallback(() => session.mutation !== null, [session]);
  const clearMutationError = useCallback(() => {
    if (session.active) update({ mutationError: null });
  }, [session, update]);

  const { reading, mutating, readError, mutationError } = state.session === session ? state : IDLE;
  return {
    reading, mutating, readError, mutationError,
    refresh, mutate, isMutating, clearMutationError,
  };
}
