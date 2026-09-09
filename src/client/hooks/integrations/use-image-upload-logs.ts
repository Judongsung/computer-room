import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ImageUploadLog, ImageUploadLogOutcome } from "@/types/integrations/image-upload-log";
import { IMAGE_UPLOAD_LOG_COPY } from "@client/content/ko/integrations/image-upload-log";
import { messageFromError } from "@client/errors/error-message";
import type { ImageUploadLogGateway } from "@client/types/integrations/image-upload-log";

interface LogSession {
  readonly gateway: ImageUploadLogGateway;
  readonly enabled: boolean;
  readonly outcome: ImageUploadLogOutcome | null;
  readonly profileId: string | null;
  active: boolean;
  first: { promise: Promise<void> } | null;
  append: object | null;
}

interface LogState {
  readonly session: LogSession;
  readonly items: readonly ImageUploadLog[];
  readonly nextCursor: string | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export function useImageUploadLogs(gateway: ImageUploadLogGateway, enabled: boolean) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ImageUploadLogOutcome | null>(null);
  const session = useMemo<LogSession>(
    () => ({ gateway, enabled, outcome, profileId, active: false, first: null, append: null }),
    [enabled, gateway, outcome, profileId],
  );
  const initial = useCallback((): LogState => ({
    session, items: [], nextCursor: null, loading: false, error: null,
  }), [session]);
  const [state, setState] = useState<LogState>(initial);
  const current = state.session === session ? state : initial();

  useLayoutEffect(() => {
    session.active = enabled;
    setState(initial());
    return () => {
      session.active = false;
      session.first = null;
      session.append = null;
    };
  }, [enabled, initial, session]);

  const update = useCallback((patch: Partial<Omit<LogState, "session">>) => {
    setState((value) => ({
      ...(value.session === session ? value : initial()),
      ...patch,
    }));
  }, [initial, session]);

  const refresh = useCallback((): Promise<void> => {
    if (!session.active) return Promise.resolve();
    if (session.first) return session.first.promise;
    session.append = null;
    const request = { promise: Promise.resolve() };
    session.first = request;
    update({ loading: true });
    request.promise = (async () => {
      try {
        const page = await gateway.listImageUploadLogs({
          ...(profileId ? { profileId } : {}),
          ...(outcome ? { outcome } : {}),
        });
        if (session.active && session.first === request) {
          update({ items: page.items, nextCursor: page.nextCursor, error: null });
        }
      } catch (reason) {
        if (session.active && session.first === request) {
          update({ error: messageFromError(reason, IMAGE_UPLOAD_LOG_COPY.LOAD_FAILED) });
        }
      } finally {
        if (session.active && session.first === request) {
          session.first = null;
          update({ loading: false });
        }
      }
    })();
    return request.promise;
  }, [gateway, outcome, profileId, session, update]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const loadMore = useCallback(async (): Promise<void> => {
    const cursor = current.nextCursor;
    if (!session.active || !cursor || session.first || session.append) return;
    const token = {};
    session.append = token;
    update({ loading: true });
    const isCurrent = () => session.active && session.append === token;
    try {
      const page = await gateway.listImageUploadLogs({
        ...(profileId ? { profileId } : {}),
        ...(outcome ? { outcome } : {}),
        cursor,
      });
      if (isCurrent()) {
        update({
          items: mergeLogs(current.items, page.items),
          nextCursor: page.nextCursor,
          error: null,
        });
      }
    } catch (reason) {
      if (isCurrent()) {
        update({ error: messageFromError(reason, IMAGE_UPLOAD_LOG_COPY.LOAD_FAILED) });
      }
    } finally {
      if (isCurrent()) {
        session.append = null;
        update({ loading: false });
      }
    }
  }, [current.items, current.nextCursor, gateway, outcome, profileId, session, update]);

  return {
    items: current.items, profileId, outcome, nextCursor: current.nextCursor,
    loading: current.loading, error: current.error,
    setProfileId, setOutcome, refresh, loadMore,
  } as const;
}

function mergeLogs(
  current: readonly ImageUploadLog[],
  incoming: readonly ImageUploadLog[],
): readonly ImageUploadLog[] {
  const known = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !known.has(item.id))];
}
