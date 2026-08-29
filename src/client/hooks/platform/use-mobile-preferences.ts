import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MobilePreferences } from "@/types/platform/mobile-preferences";
import { messageFromError } from "@client/errors/error-message";
import type { MobilePreferencesGateway } from "@client/types/platform/mobile-preferences";

const DEFAULT_PREFERENCES: MobilePreferences = { wallpaper: null };

export function useMobilePreferences(gateway: MobilePreferencesGateway) {
  const requestSequence = useRef(0);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const next = await gateway.getPreferences();
      if (requestSequence.current !== requestId) return;
      setPreferences(next);
      setError(null);
    } catch (caught) {
      if (requestSequence.current !== requestId) return;
      setError(messageFromError(caught, MOBILE_COPY.WALLPAPER_LOAD_FAILED));
    } finally {
      if (requestSequence.current === requestId) setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
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

  const updateWallpaper = useCallback(
    async (entryId: string | null): Promise<boolean> => {
      const requestId = ++requestSequence.current;
      setSaving(true);
      setError(null);
      try {
        const next = await gateway.updateWallpaper(entryId);
        if (requestSequence.current !== requestId) return false;
        setPreferences(next);
        return true;
      } catch (caught) {
        if (requestSequence.current === requestId) {
          setError(messageFromError(caught, MOBILE_COPY.WALLPAPER_SAVE_FAILED));
        }
        return false;
      } finally {
        if (requestSequence.current === requestId) setSaving(false);
      }
    },
    [gateway],
  );

  return {
    preferences,
    loading,
    saving,
    error,
    refresh,
    updateWallpaper,
  };
}
