import { PROGRAM_DOCUMENT_COPY as COPY } from "@client/content/ko/desktop/program-documents";
import { UI_LOCALE } from "@client/content/ko/shared/format";
import { useEffect, useMemo, useState } from "react";
import { CHECKLIST_EVENT_ACTION } from "@/constants/widgets/checklist";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { ChecklistLogEvent } from "@/types/widgets/widget";
import {
  CHECKLIST_LOG_TIME_FORMAT_OPTIONS,
  CHECKLIST_WIDGET_COPY,
} from "@client/content/ko/widgets/content";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import { messageFromError } from "@client/errors/error-message";
import type { ChecklistGateway } from "@client/types/widgets/ports/checklist";
import { DesktopModal } from "@client/components/desktop/desktop-modal";
import { ChecklistRetentionSettings } from "@client/components/desktop/checklist/checklist-retention-settings";

const LOG_TIME_FORMATTER = new Intl.DateTimeFormat(
  UI_LOCALE,
  CHECKLIST_LOG_TIME_FORMAT_OPTIONS,
);

const CHECKLIST_EVENT_LABEL_BY_ACTION = {
  [CHECKLIST_EVENT_ACTION.ADDED]: CHECKLIST_WIDGET_COPY.ADDED,
  [CHECKLIST_EVENT_ACTION.RENAMED]: CHECKLIST_WIDGET_COPY.RENAMED,
  [CHECKLIST_EVENT_ACTION.DELETED]: CHECKLIST_WIDGET_COPY.DELETED,
  [CHECKLIST_EVENT_ACTION.CHECKED]: CHECKLIST_WIDGET_COPY.CHECKED,
  [CHECKLIST_EVENT_ACTION.UNCHECKED]: CHECKLIST_WIDGET_COPY.UNCHECKED,
} as const;

interface ChecklistLogDialogProps {
  readonly widgetId: string;
  readonly gateway: ChecklistGateway;
  readonly onClose: () => void;
}

export function ChecklistLogDialog({
  widgetId,
  gateway,
  onClose,
}: ChecklistLogDialogProps) {
  const [events, setEvents] = useState<readonly ChecklistLogEvent[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void gateway
      .listChecklistLogs(widgetId)
      .then((page) => {
        if (active) {
          setEvents(page.items);
          setNextOffset(page.nextOffset);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            messageFromError(loadError, CHECKLIST_WIDGET_COPY.LOG_LOAD_FAILED),
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [gateway, widgetId]);

  const groups = useMemo(() => groupEventsByDate(events), [events]);

  const loadMore = async (): Promise<void> => {
    if (nextOffset === null || isLoading) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const page = await gateway.listChecklistLogs(widgetId, nextOffset);
      setEvents((current) => [...current, ...page.items]);
      setNextOffset(page.nextOffset);
    } catch (loadError) {
      setError(messageFromError(loadError, CHECKLIST_WIDGET_COPY.LOG_LOAD_FAILED));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DesktopModal
      title={CHECKLIST_WIDGET_COPY.LOG_TITLE}
      iconPath={WIDGET_ICON_PATH_BY_TYPE[WIDGET_TYPE.DAILY_CHECKLIST]}
      windowClassName="checklist-log-dialog desktop-program-history"
      bodyClassName="checklist-log-dialog__body"
      closeOnBackdrop
      onRequestClose={onClose}
      footer={
        <footer className="desktop-history-footer">
          <span role="status">{COPY.RECORD_COUNT(events.length)}</span>
          {nextOffset !== null ? <button type="button" onClick={() => void loadMore()} disabled={isLoading}>{CHECKLIST_WIDGET_COPY.LOAD_MORE}</button> : null}
          <button type="button" onClick={onClose}>{CHECKLIST_WIDGET_COPY.CLOSE}</button>
        </footer>
      }
    >
      <ChecklistRetentionSettings />
      {isLoading && events.length === 0 ? (
        <p className="widget-empty">{CHECKLIST_WIDGET_COPY.LOG_LOADING}</p>
      ) : null}
      {!isLoading && groups.length === 0 && !error ? (
        <p className="widget-empty">{CHECKLIST_WIDGET_COPY.LOG_EMPTY}</p>
      ) : null}
      {groups.map(([businessDate, groupedEvents]) => (
        <section className="checklist-log-group" key={businessDate}>
          <h4>{businessDate}</h4>
          <table className="desktop-history-table">
            <thead><tr><th scope="col">{COPY.TIME}</th><th scope="col">{COPY.ITEM}</th><th scope="col">{COPY.ACTION}</th></tr></thead>
            <tbody>
            {groupedEvents.map((event) => (
              <tr key={event.id}>
                <td><time dateTime={event.occurredAt}>
                  {LOG_TIME_FORMATTER.format(new Date(event.occurredAt))}
                </time></td>
                <td>{eventLabel(event)}</td>
                <td>{CHECKLIST_EVENT_LABEL_BY_ACTION[event.action]}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </section>
      ))}
      {error ? <p className="widget-error" role="alert">{error}</p> : null}
    </DesktopModal>
  );
}

function eventLabel(event: ChecklistLogEvent): string {
  if (
    event.action === CHECKLIST_EVENT_ACTION.RENAMED &&
    event.previousItemLabel !== null
  ) {
    return `${event.previousItemLabel} → ${event.itemLabel}`;
  }
  return event.itemLabel;
}

function groupEventsByDate(
  events: readonly ChecklistLogEvent[],
): Array<readonly [string, readonly ChecklistLogEvent[]]> {
  const groups = new Map<string, ChecklistLogEvent[]>();
  for (const event of events) {
    const group = groups.get(event.businessDate) ?? [];
    group.push(event);
    groups.set(event.businessDate, group);
  }
  return [...groups.entries()];
}
