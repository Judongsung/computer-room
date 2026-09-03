import { useCallback, useEffect, useRef, useState } from "react";
import { IMAGE_UPLOAD_LOG_RETENTION } from "@/constants/integrations/image-upload-log";
import { isImageUploadLogRetentionDays } from "@/domain/integrations/image-upload-log";
import { IMAGE_UPLOAD_LOG_COPY } from "@client/content/ko/integrations/image-upload-log";
import { messageFromError } from "@client/errors/error-message";
import type { ImageUploadLogGateway } from "@client/types/integrations/image-upload-log";

export function useImageUploadLogSettings(
  gateway: ImageUploadLogGateway,
  enabled: boolean,
) {
  const requestSequence = useRef(0);
  const [retentionDays, setRetentionDays] = useState<number>(
    IMAGE_UPLOAD_LOG_RETENTION.DEFAULT_DAYS,
  );
  const [draft, setDraft] = useState(
    String(IMAGE_UPLOAD_LOG_RETENTION.DEFAULT_DAYS),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const settings = await gateway.getImageUploadLogSettings();
      if (requestId !== requestSequence.current) return;
      setRetentionDays(settings.retentionDays);
      setDraft(String(settings.retentionDays));
    } catch (caught) {
      if (requestId !== requestSequence.current) return;
      setError(
        messageFromError(caught, IMAGE_UPLOAD_LOG_COPY.SETTINGS_LOAD_FAILED),
      );
      setLoadFailed(true);
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [enabled, gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (): Promise<boolean> => {
    const nextRetentionDays = Number(draft);
    if (!isImageUploadLogRetentionDays(nextRetentionDays)) {
      setError(IMAGE_UPLOAD_LOG_COPY.INVALID_RETENTION_DAYS);
      setLoadFailed(false);
      return false;
    }
    const requestId = ++requestSequence.current;
    setSaving(true);
    setError(null);
    setLoadFailed(false);
    try {
      const settings = await gateway.updateImageUploadLogRetentionDays(
        nextRetentionDays,
      );
      if (requestId !== requestSequence.current) return false;
      setRetentionDays(settings.retentionDays);
      setDraft(String(settings.retentionDays));
      return true;
    } catch (caught) {
      if (requestId === requestSequence.current) {
        setError(
          messageFromError(caught, IMAGE_UPLOAD_LOG_COPY.SETTINGS_SAVE_FAILED),
        );
      }
      return false;
    } finally {
      if (requestId === requestSequence.current) setSaving(false);
    }
  }, [draft, gateway]);

  return {
    retentionDays,
    draft,
    loading,
    saving,
    error,
    loadFailed,
    setDraft,
    load,
    save,
  } as const;
}
