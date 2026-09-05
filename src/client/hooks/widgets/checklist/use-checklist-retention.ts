import { useEffect, useRef, useState } from "react";
import { CHECKLIST_RETENTION } from "@/constants/widgets/checklist-retention";
import { isChecklistRetentionDays } from "@/domain/widgets/checklist-retention";
import { checklistRetentionApi } from "@client/api/widgets/checklist-retention-api-client";
import { CHECKLIST_RETENTION_COPY as COPY } from "@client/content/ko/widgets/checklist-retention";
import { messageFromError } from "@client/errors/error-message";

export function useChecklistRetention() {
  const [expanded, setExpanded] = useState(false);
  const [unlimited, setUnlimited] = useState(true);
  const [days, setDays] = useState(String(CHECKLIST_RETENTION.SUGGESTED_DAYS));
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const sequence = useRef(0);

  useEffect(() => {
    const request = ++sequence.current;
    if (!expanded) return;
    setBusy(true);
    setLoaded(false);
    setError(null);
    setSaved(false);
    void checklistRetentionApi.getSettings().then((settings) => {
      if (request !== sequence.current) return;
      setUnlimited(settings.retentionDays === null);
      setDays(String(settings.retentionDays ?? CHECKLIST_RETENTION.SUGGESTED_DAYS));
      setLoaded(true);
    }).catch((caught: unknown) => {
      if (request === sequence.current) setError(messageFromError(caught, COPY.FAILED));
    }).finally(() => {
      if (request === sequence.current) setBusy(false);
    });
    return () => { sequence.current++; };
  }, [expanded]);

  const save = async (): Promise<void> => {
    if (busy || !loaded) return;
    const retentionDays = unlimited ? null : Number(days);
    if (!isChecklistRetentionDays(retentionDays)) {
      setError(COPY.INVALID);
      return;
    }
    const request = sequence.current;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await checklistRetentionApi.updateRetentionDays(retentionDays);
      if (request === sequence.current) setSaved(true);
    } catch (caught) {
      if (request === sequence.current) setError(messageFromError(caught, COPY.FAILED));
    } finally {
      if (request === sequence.current) setBusy(false);
    }
  };

  return {
    expanded, setExpanded, unlimited, days, busy, loaded, error, saved, save,
    setUnlimited: (value: boolean) => { setUnlimited(value); setSaved(false); },
    setDays: (value: string) => { setDays(value); setSaved(false); },
  };
}
