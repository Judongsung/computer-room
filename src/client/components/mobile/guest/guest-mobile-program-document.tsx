import { useWidgetRequestCoordinator } from "@client/hooks/widgets/use-widget-request-coordinator";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { useChecklistRefresh } from "@client/hooks/widgets/checklist/use-checklist-refresh";
import { useEffect, useMemo, useState } from "react";
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
  const scope = useMemo(() => ({}), [entryId, gateway]);
  const [stored, setStored] = useState<{ scope: object; document: GuestProgramDocument | null; failed: boolean } | null>(null);
  const document = stored?.scope === scope ? stored.document : null;
  const requests = useWidgetRequestCoordinator({
    scope,
    read: () => gateway.getProgramDocument(entryId),
    onRead: document => setStored({ scope, document, failed: false }),
  });
  useEffect(() => { void requests.refresh(); }, [requests.refresh]);
  // Keep the last failure visible during retries, until a valid read succeeds.
  useEffect(() => {
    if (requests.readError) setStored(current => ({ scope,
      document: current?.scope === scope ? current.document : null, failed: true }));
  }, [requests.readError, scope]);
  const error = requests.readError || (stored?.scope === scope && stored.failed)
    ? GUEST_COPY.PROGRAM_LOAD_FAILED : null;
  useChecklistRefresh({ nextResetAt: document?.type === WIDGET_TYPE.DAILY_CHECKLIST ? document.data.nextResetAt : "", refresh: requests.refresh });

  return (
    <MobileActivity title={document?.entry.name ?? title}>
      {error ? <div className={MOBILE_CLASS_NAME.ERROR} role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => void requests.refresh()}>{MOBILE_COPY.RETRY}</button>
      </div> : null}
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
