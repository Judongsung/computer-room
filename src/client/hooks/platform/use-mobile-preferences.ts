import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { MobilePreferences } from "@/types/platform/mobile-preferences";
import { messageFromError } from "@client/errors/error-message";
import type { MobilePreferencesGateway } from "@client/types/platform/mobile-preferences";

interface ReadRequest {
  promise: Promise<void>;
}

const INITIAL_STATE = {
  preferences: { wallpaper: null } as MobilePreferences,
  loading: true,
  saving: false,
  readError: null as string | null,
  saveError: null as string | null,
};

export function useMobilePreferences(gateway: MobilePreferencesGateway) {
  const session = useMemo(() => ({
    gateway,
    active: false,
    read: null as ReadRequest | null,
    save: null as object | null,
    refreshPending: false,
  }), [gateway]);
  const [state, setState] = useState({ session, ...INITIAL_STATE });
  const update = useCallback((patch: Partial<typeof INITIAL_STATE>) => {
    setState((current) => ({
      ...(current.session === session ? current : { session, ...INITIAL_STATE }),
      ...patch,
    }));
  }, [session]);

  useLayoutEffect(() => {
    session.active = true;
    setState({ session, ...INITIAL_STATE });
    return () => {
      session.active = false;
      session.read = null;
      session.save = null;
      session.refreshPending = false;
    };
  }, [session]);

  const refresh = useCallback((): Promise<void> => {
    if (!session.active) return Promise.resolve();
    if (session.save) {
      session.refreshPending = true;
      return Promise.resolve();
    }
    if (session.read) return session.read.promise;
    const request: ReadRequest = { promise: Promise.resolve() };
    session.read = request;
    update({ loading: true });
    const current = () => session.active && session.read === request;
    request.promise = (async () => {
      try {
        const preferences = await session.gateway.getPreferences();
        if (current()) update({ preferences, readError: null });
      } catch (caught) {
        if (current()) update({ readError: messageFromError(caught, MOBILE_COPY.WALLPAPER_LOAD_FAILED) });
      } finally {
        if (current()) {
          session.read = null;
          update({ loading: false });
        }
      }
    })();
    return request.promise;
  }, [session, update]);

  useEffect(() => {
    void refresh();
    const refreshOnFocus = (): void => void refresh();
    const refreshWhenVisible = (): void => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  const updateWallpaper = useCallback(async (entryId: string | null): Promise<boolean> => {
    if (!session.active || session.save) return false;
    const token = {};
    session.save = token;
    if (session.read) {
      session.read = null;
      session.refreshPending = true;
    }
    update({ saving: true, loading: false, saveError: null });
    const current = () => session.active && session.save === token;
    try {
      const preferences = await session.gateway.updateWallpaper(entryId);
      if (!current()) return false;
      update({ preferences });
      return true;
    } catch (caught) {
      if (current()) update({ saveError: messageFromError(caught, MOBILE_COPY.WALLPAPER_SAVE_FAILED) });
      return false;
    } finally {
      if (current()) {
        session.save = null;
        update({ saving: false });
        if (session.refreshPending) {
          session.refreshPending = false;
          void refresh();
        }
      }
    }
  }, [refresh, session, update]);

  const current = state.session === session ? state : INITIAL_STATE;
  return {
    preferences: current.preferences,
    loading: current.loading,
    saving: current.saving,
    error: current.saveError ?? current.readError,
    refresh,
    updateWallpaper,
  };
}
