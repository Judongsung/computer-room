import { useEffect, useState } from "react";
import type { ChecklistLogEvent } from "@/types/widgets/widget";
import { MobileDialog } from "@client/components/mobile/shared/mobile-dialog";
import { MOBILE_CLASS_NAME, MOBILE_COPY } from "@client/constants/shared/mobile";
import { CHECKLIST_WIDGET_COPY } from "@client/constants/widgets/content";
import type { ChecklistGateway } from "@client/types/widgets/ports/checklist";

interface MobileChecklistLogsProps {
  readonly widgetId: string;
  readonly gateway: ChecklistGateway;
  readonly onClose: () => void;
}

export function MobileChecklistLogs({ widgetId, gateway, onClose }: MobileChecklistLogsProps) {
  const [events, setEvents] = useState<readonly ChecklistLogEvent[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void gateway.listChecklistLogs(widgetId).then(
      (page) => {
        if (!active) return;
        setEvents(page.items);
        setNextOffset(page.nextOffset);
        setLoading(false);
      },
      (caught: unknown) => {
        if (!active) return;
        setError(errorMessage(caught));
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [gateway, widgetId]);

  const loadMore = async (): Promise<void> => {
    if (nextOffset === null || loading) return;
    setLoading(true);
    try {
      const page = await gateway.listChecklistLogs(widgetId, nextOffset);
      setEvents((current) => [...current, ...page.items]);
      setNextOffset(page.nextOffset);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileDialog
      title={CHECKLIST_WIDGET_COPY.LOG_TITLE}
      actions={
        <>
          {nextOffset !== null ? <button type="button" disabled={loading} onClick={() => void loadMore()}>{MOBILE_COPY.LOAD_MORE}</button> : null}
          <button type="button" onClick={onClose}>{MOBILE_COPY.DONE}</button>
        </>
      }
    >
      {loading && events.length === 0 ? <p>{MOBILE_COPY.LOADING}</p> : null}
      {!loading && events.length === 0 ? <p>{MOBILE_COPY.NO_LOGS}</p> : null}
      <ol className={MOBILE_CLASS_NAME.LIST}>
        {events.map((event) => (
          <li key={event.id} className={MOBILE_CLASS_NAME.LIST_ITEM}>
            <span className={MOBILE_CLASS_NAME.LIST_TEXT}>
              <strong>{event.itemLabel}</strong>
              <small className={MOBILE_CLASS_NAME.LIST_META}>{event.businessDate} · {event.action}</small>
            </span>
          </li>
        ))}
      </ol>
      {error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{error}</p> : null}
    </MobileDialog>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : CHECKLIST_WIDGET_COPY.LOG_LOAD_FAILED;
}
