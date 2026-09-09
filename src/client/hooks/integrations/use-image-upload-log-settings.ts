import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { IMAGE_UPLOAD_LOG_RETENTION } from "@/constants/integrations/image-upload-log";
import { isImageUploadLogRetentionDays } from "@/domain/integrations/image-upload-log";
import { IMAGE_UPLOAD_LOG_COPY } from "@client/content/ko/integrations/image-upload-log";
import { messageFromError } from "@client/errors/error-message";
import type { ImageUploadLogGateway } from "@client/types/integrations/image-upload-log";

interface SettingsSession {
  readonly gateway: ImageUploadLogGateway;
  readonly enabled: boolean;
  active: boolean;
  pending: object | null;
}

interface SettingsState {
  readonly session: SettingsSession;
  readonly retentionDays: number;
  readonly draft: string;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
  readonly loadFailed: boolean;
  readonly loaded: boolean;
}

export function useImageUploadLogSettings(
  gateway: ImageUploadLogGateway,
  enabled: boolean,
) {
  const session = useMemo<SettingsSession>(
    () => ({ gateway, enabled, active: false, pending: null }),
    [enabled, gateway],
  );
  const initial = useCallback((): SettingsState => ({
    session,
    retentionDays: IMAGE_UPLOAD_LOG_RETENTION.DEFAULT_DAYS,
    draft: String(IMAGE_UPLOAD_LOG_RETENTION.DEFAULT_DAYS),
    loading: false,
    saving: false,
    error: null,
    loadFailed: false,
    loaded: false,
  }), [session]);
  const [state, setState] = useState<SettingsState>(initial);
  const current = state.session === session ? state : initial();

  useLayoutEffect(() => {
    session.active = enabled;
    setState(initial());
    return () => {
      session.active = false;
      session.pending = null;
    };
  }, [enabled, initial, session]);

  const update = useCallback((patch: Partial<Omit<SettingsState, "session">>) => {
    setState((value) => ({
      ...(value.session === session ? value : initial()),
      ...patch,
    }));
  }, [initial, session]);

  const load = useCallback(async (): Promise<void> => {
    if (!session.active || session.pending) return;
    const token = {};
    session.pending = token;
    update({ loading: true });
    const isCurrent = () => session.active && session.pending === token;
    try {
      const settings = await gateway.getImageUploadLogSettings();
      if (isCurrent()) {
        update({
          retentionDays: settings.retentionDays,
          draft: String(settings.retentionDays),
          error: null,
          loadFailed: false,
          loaded: true,
        });
      }
    } catch (reason) {
      if (isCurrent()) {
        update({
          error: messageFromError(reason, IMAGE_UPLOAD_LOG_COPY.SETTINGS_LOAD_FAILED),
          loadFailed: true,
          loaded: false,
        });
      }
    } finally {
      if (isCurrent()) {
        session.pending = null;
        update({ loading: false });
      }
    }
  }, [gateway, session, update]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const setDraft = useCallback((draft: string): void => {
    if (session.active) update({ draft });
  }, [session, update]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!session.active || session.pending || !current.loaded) return false;
    const nextRetentionDays = Number(current.draft);
    if (!isImageUploadLogRetentionDays(nextRetentionDays)) {
      update({ error: IMAGE_UPLOAD_LOG_COPY.INVALID_RETENTION_DAYS, loadFailed: false });
      return false;
    }
    const token = {};
    session.pending = token;
    update({ saving: true, error: null, loadFailed: false });
    const isCurrent = () => session.active && session.pending === token;
    try {
      const settings = await gateway.updateImageUploadLogRetentionDays(nextRetentionDays);
      if (!isCurrent()) return false;
      update({
        retentionDays: settings.retentionDays,
        draft: String(settings.retentionDays),
        error: null,
        loaded: true,
      });
      return true;
    } catch (reason) {
      if (isCurrent()) {
        update({ error: messageFromError(reason, IMAGE_UPLOAD_LOG_COPY.SETTINGS_SAVE_FAILED) });
      }
      return false;
    } finally {
      if (isCurrent()) {
        session.pending = null;
        update({ saving: false });
      }
    }
  }, [current.draft, current.loaded, gateway, session, update]);

  return {
    retentionDays: current.retentionDays,
    draft: current.draft,
    loading: current.loading,
    saving: current.saving,
    error: current.error,
    loadFailed: current.loadFailed,
    canSave: session.active && current.loaded && !session.pending,
    setDraft,
    load,
    save,
  } as const;
}
