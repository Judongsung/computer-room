import type { ChecklistRetentionUseCases } from "@/types/widgets/checklist/retention";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { MobileChecklistRetentionSettings } from "@client/components/mobile/widgets/mobile-checklist-retention-settings";
import { useEffect, useState } from "react";
import type { ChecklistLogEvent } from "@/types/widgets/widget";
import { MobileDialog } from "@client/components/mobile/shared/mobile-dialog";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { CHECKLIST_WIDGET_COPY } from "@client/content/ko/widgets/content";
import { messageFromError } from "@client/errors/error-message";
import type { ChecklistGateway } from "@client/types/widgets/ports/checklist";

interface MobileChecklistLogsProps {
  readonly checklistRetentionGateway: ChecklistRetentionUseCases;
  readonly widgetId: string;
  readonly gateway: ChecklistGateway;
  readonly onClose: () => void;
}

export function MobileChecklistLogs({ widgetId, gateway, checklistRetentionGateway, onClose }: MobileChecklistLogsProps) {
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
        setError(
          messageFromError(caught, CHECKLIST_WIDGET_COPY.LOG_LOAD_FAILED),
        );
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
      setError(
        messageFromError(caught, CHECKLIST_WIDGET_COPY.LOG_LOAD_FAILED),
      );
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
      <div className="android-checklist-logs-body">
      <MobileChecklistRetentionSettings gateway={checklistRetentionGateway} />
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
      </div>
    </MobileDialog>
  );
}
