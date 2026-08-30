import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ImageUploadLog,
  ImageUploadLogOutcome,
} from "@/types/integrations/image-upload-log";
import { IMAGE_UPLOAD_LOG_COPY } from "@client/content/ko/integrations/image-upload-log";
import { messageFromError } from "@client/errors/error-message";
import type { ImageUploadLogGateway } from "@client/types/integrations/image-upload-log";

export function useImageUploadLogs(
  gateway: ImageUploadLogGateway,
  enabled: boolean,
) {
  const [items, setItems] = useState<readonly ImageUploadLog[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ImageUploadLogOutcome | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(
    async (append = false): Promise<void> => {
      if (!enabled || (append && (!nextCursor || loading))) return;
      const requestId = ++requestSequence.current;
      setLoading(true);
      setError(null);
      try {
        const page = await gateway.listImageUploadLogs({
          ...(profileId ? { profileId } : {}),
          ...(outcome ? { outcome } : {}),
          ...(append && nextCursor ? { cursor: nextCursor } : {}),
        });
        if (requestId !== requestSequence.current) return;
        setItems((current) =>
          append ? mergeLogs(current, page.items) : page.items,
        );
        setNextCursor(page.nextCursor);
      } catch (caught) {
        if (requestId !== requestSequence.current) return;
        setError(messageFromError(caught, IMAGE_UPLOAD_LOG_COPY.LOAD_FAILED));
      } finally {
        if (requestId === requestSequence.current) setLoading(false);
      }
    }, [enabled, gateway, loading, nextCursor, outcome, profileId],
  );

  useEffect(() => {
    if (!enabled) return;
    setItems([]);
    setNextCursor(null);
    void load(false);
  }, [enabled, outcome, profileId]);

  return {
    items,
    profileId,
    outcome,
    nextCursor,
    loading,
    error,
    setProfileId,
    setOutcome,
    refresh: () => load(false),
    loadMore: () => load(true),
  } as const;
}

function mergeLogs(
  current: readonly ImageUploadLog[],
  incoming: readonly ImageUploadLog[],
): readonly ImageUploadLog[] {
  const known = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !known.has(item.id))];
}
