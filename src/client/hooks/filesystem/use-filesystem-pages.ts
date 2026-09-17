import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { AUTH_ERRORS } from "@/constants/platform/errors/auth";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { GUEST_ERRORS } from "@/constants/guest/errors/guest";
import { ApiError } from "@client/errors/api-error";
import { messageFromError } from "@client/errors/error-message";

interface FilesystemPage {
  readonly nextOffset: number | null;
}

type PageOperation = "reload" | "more";

interface PageRequest {
  readonly operation: PageOperation;
  promise: Promise<void>;
}

interface PageSession<TPage> {
  readonly read: (offset: number) => Promise<TPage>;
  active: boolean;
  page: TPage | null;
  loadedPageCount: number;
  pending: PageRequest | null;
  failedOperation: PageOperation;
}

interface PageState<TPage> {
  readonly session: PageSession<TPage>;
  readonly page: TPage | null;
  readonly error: string | null;
  readonly operation: PageOperation | null;
}

export function useFilesystemPages<TPage extends FilesystemPage>(
  read: (offset: number) => Promise<TPage>,
  merge: (previous: TPage | null, next: TPage) => TPage,
  revision: number,
  errorFallback: string,
) {
  const session = useMemo<PageSession<TPage>>(() => ({
    read,
    active: false,
    page: null,
    loadedPageCount: 0,
    pending: null,
    failedOperation: "reload",
  }), [read]);
  const [state, setState] = useState<PageState<TPage>>({
    session,
    page: null,
    error: null,
    operation: "reload",
  });

  const publish = useCallback((operation: PageOperation | null, error?: string | null): void => {
    if (!session.active) return;
    const page = session.page;
    setState((current) => ({
      session,
      page,
      operation,
      error: error === undefined
        ? current.session === session ? current.error : null
        : error,
    }));
  }, [session]);

  const run = useCallback((operation: PageOperation, force = false): Promise<void> => {
    if (!session.active) return Promise.resolve();
    if (!force && session.pending?.operation === "reload") return session.pending.promise;
    if (!force && session.pending?.operation === operation) return session.pending.promise;
    const nextOffset = session.page?.nextOffset;
    if (operation === "more" && (nextOffset === undefined || nextOffset === null)) {
      return Promise.resolve();
    }

    const request: PageRequest = { operation, promise: Promise.resolve() };
    session.pending = request;
    publish(operation);
    const isCurrent = (): boolean => session.active && session.pending === request;
    request.promise = (async () => {
      try {
        let page = operation === "more" ? session.page : null;
        let loadedPageCount = operation === "more" ? session.loadedPageCount : 0;
        let offset = operation === "more" ? nextOffset ?? 0 : 0;
        const targetCount = operation === "more"
          ? loadedPageCount + 1
          : Math.max(1, session.loadedPageCount);

        do {
          const next = await session.read(offset);
          if (!isCurrent()) return;
          page = merge(page, next);
          loadedPageCount += 1;
          if (next.nextOffset === null) break;
          offset = next.nextOffset;
        } while (loadedPageCount < targetCount);

        session.page = page;
        session.loadedPageCount = loadedPageCount;
        publish(null, null);
      } catch (reason) {
        if (!isCurrent()) return;
        session.failedOperation = operation;
        if (invalidatesListing(reason)) {
          session.page = null;
          session.loadedPageCount = 0;
          session.failedOperation = "reload";
        }
        publish(null, messageFromError(reason, errorFallback));
      } finally {
        if (isCurrent()) session.pending = null;
      }
    })();
    return request.promise;
  }, [errorFallback, merge, publish, session]);

  useLayoutEffect(() => {
    session.active = true;
    void run("reload", true);
    return () => {
      session.active = false;
      session.pending = null;
    };
  }, [run, session, revision]);

  const reload = useCallback(() => run("reload"), [run]);
  const loadMore = useCallback(() => run("more"), [run]);
  const retry = useCallback(() => run(session.failedOperation), [run, session]);
  // The successful sort write sends a revision notification after this reset.
  const reset = useCallback((): void => {
    session.pending = null;
    session.page = null;
    session.loadedPageCount = 0;
    publish(null, null);
  }, [publish, session]);
  const visible = state.session === session
    ? state
    : { page: null, error: null, operation: "reload" };

  return {
    page: visible.page,
    error: visible.error,
    isInitialLoading: visible.operation === "reload" && !visible.page,
    isRefreshing: visible.operation === "reload" && Boolean(visible.page),
    isLoadingMore: visible.operation === "more",
    reload,
    reset,
    loadMore,
    retry,
  } as const;
}

function invalidatesListing(reason: unknown): boolean {
  const codes: readonly string[] = [
    AUTH_ERRORS.AUTHENTICATION_REQUIRED.code,
    AUTH_ERRORS.EMAIL_CLAIM_REQUIRED.code,
    AUTH_ERRORS.OWNER_ONLY.code,
    AUTH_ERRORS.INVALID_ACCESS_TOKEN.code,
    FILESYSTEM_ERRORS.ENTRY_NOT_FOUND.code,
    FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND.code,
    FILESYSTEM_ERRORS.ENTRY_NOT_ACTIVE.code,
    FILESYSTEM_ERRORS.INVALID_PARENT.code,
    GUEST_ERRORS.RESOURCE_NOT_FOUND.code,
  ];
  return reason instanceof ApiError && codes.includes(reason.code);
}

export function mergeFilesystemItems<TItem>(
  previous: readonly TItem[],
  next: readonly TItem[],
  id: (item: TItem) => string,
): TItem[] {
  const items = new Map(previous.map((item) => [id(item), item]));
  next.forEach((item) => items.set(id(item), item));
  return [...items.values()];
}
