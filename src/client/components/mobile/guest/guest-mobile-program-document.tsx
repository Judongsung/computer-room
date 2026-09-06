import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { useChecklistRefresh } from "@client/hooks/widgets/checklist/use-checklist-refresh";
import { useCallback, useEffect, useState } from "react";
import type { GuestProgramDocument } from "@/types/guest/guest";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { ReadOnlyProgramContent } from "@client/components/widgets/read-only-program-content";
import { GUEST_MOBILE_CLASS_NAME } from "@client/constants/guest/guest";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import type { GuestGateway } from "@client/types/guest/guest";

interface GuestMobileProgramDocumentProps {
  readonly entryId: string;
  readonly title: string;
  readonly gateway: GuestGateway;
}

export function GuestMobileProgramDocument({
  entryId,
  title,
  gateway,
}: GuestMobileProgramDocumentProps) {
  const [document, setDocument] = useState<GuestProgramDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setDocument(null);
    setError(null);
    void gateway.getProgramDocument(entryId).then(
      (value) => {
        if (active) setDocument(value);
      },
      () => {
        if (active) setError(GUEST_COPY.PROGRAM_LOAD_FAILED);
      },
    );
    return () => {
      active = false;
    };
  }, [entryId, gateway]);

  const refresh = useCallback(async (): Promise<void> => {
    try { setDocument(await gateway.getProgramDocument(entryId)); setError(null); }
    catch { setError(GUEST_COPY.PROGRAM_LOAD_FAILED); }
  }, [entryId, gateway]);
  useChecklistRefresh({ nextResetAt: document?.type === WIDGET_TYPE.DAILY_CHECKLIST ? document.data.nextResetAt : "", refresh });

  return (
    <MobileActivity title={document?.entry.name ?? title}>
      {error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{error}</p> : null}
      {!document && !error ? (
        <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.LOADING}</p>
      ) : null}
      {document ? (
        <div className={GUEST_MOBILE_CLASS_NAME.PROGRAM}>
          <ReadOnlyProgramContent program={document} />
        </div>
      ) : null}
    </MobileActivity>
  );
}
