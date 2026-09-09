import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { messageFromError } from "@client/errors/error-message";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";

export type FilesystemMutationResult<T> =
  | { readonly status: "applied"; readonly value: T }
  | { readonly status: "failed" }
  | { readonly status: "ignored" };

interface MutationSession {
  readonly gateway: object;
  active: boolean;
  pending: object | null;
}

interface MutationState {
  readonly session: MutationSession;
  readonly busy: boolean;
  readonly error: string | null;
}

export function useFilesystemMutation(gateway: object) {
  const session = useMemo<MutationSession>(
    () => ({ gateway, active: false, pending: null }),
    [gateway],
  );
  const [state, setState] = useState<MutationState>({
    session,
    busy: false,
    error: null,
  });
  const currentState = state.session === session
    ? state
    : { session, busy: false, error: null };

  useLayoutEffect(() => {
    session.active = true;
    setState({ session, busy: false, error: null });
    return () => {
      session.active = false;
      session.pending = null;
    };
  }, [session]);

  const update = useCallback((patch: Partial<Omit<MutationState, "session">>) => {
    setState((current) => ({
      ...(current.session === session
        ? current
        : { session, busy: false, error: null }),
      ...patch,
    }));
  }, [session]);

  const setError = useCallback((error: string | null): void => {
    if (session.active) update({ error });
  }, [session, update]);

  const reportError = useCallback((reason: unknown): void => {
    setError(messageFromError(reason, FILESYSTEM_COPY.CHANGE_FAILED));
  }, [setError]);

  const run = useCallback(async <T,>(
    operation: () => Promise<T>,
    onSuccess: (value: T) => void = () => undefined,
  ): Promise<FilesystemMutationResult<T>> => {
    if (!session.active || session.pending) return { status: "ignored" };
    const token = {};
    session.pending = token;
    update({ busy: true, error: null });
    const isCurrent = () => session.active && session.pending === token;
    try {
      const value = await operation();
      if (!isCurrent()) return { status: "ignored" };
      onSuccess(value);
      return { status: "applied", value };
    } catch (reason) {
      if (!isCurrent()) return { status: "ignored" };
      reportError(reason);
      return { status: "failed" };
    } finally {
      if (isCurrent()) {
        session.pending = null;
        update({ busy: false });
      }
    }
  }, [reportError, session, update]);

  return {
    busy: currentState.busy,
    error: currentState.error,
    run,
    setError,
    clearError: () => setError(null),
    reportError,
  } as const;
}
