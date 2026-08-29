import { UI_LOCALE } from "@client/content/ko/shared/format";
import { useEffect, useId, useMemo, useState } from "react";
import { CHECKLIST_EVENT_ACTION } from "@/constants/widgets/checklist";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { ChecklistLogEvent } from "@/types/widgets/widget";
import {
  CHECKLIST_LOG_TIME_FORMAT_OPTIONS,
  CHECKLIST_WIDGET_COPY,
} from "@client/content/ko/widgets/content";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { XP_WINDOW_CONTROL_ACTION } from "@client/constants/shared/xp";
import { messageFromError } from "@client/errors/error-message";
import type { ChecklistGateway } from "@client/types/widgets/ports/checklist";
import { XpWindowFrame } from "@client/components/desktop/xp-window-frame";
import { XpWindowControlButton } from "@client/components/shared/xp-window-control-button";

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
  const titleId = useId();
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

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === KEYBOARD_KEY.ESCAPE) {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

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
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <XpWindowFrame
        className="checklist-log-dialog"
        title={CHECKLIST_WIDGET_COPY.LOG_TITLE}
        titleId={titleId}
        iconPath={WIDGET_ICON_PATH_BY_TYPE[WIDGET_TYPE.DAILY_CHECKLIST]}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        bodyClassName="checklist-log-dialog__body sunken-panel"
        controls={
          <XpWindowControlButton
            action={XP_WINDOW_CONTROL_ACTION.CLOSE}
            label={CHECKLIST_WIDGET_COPY.CLOSE}
            onClick={onClose}
          />
        }
        footer={
          nextOffset !== null ? (
            <footer className="dialog-footer">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={isLoading}
              >
                {CHECKLIST_WIDGET_COPY.LOAD_MORE}
              </button>
            </footer>
          ) : null
        }
      >
        {isLoading && events.length === 0 ? (
          <p className="widget-empty">{CHECKLIST_WIDGET_COPY.LOG_LOADING}</p>
        ) : null}
        {!isLoading && groups.length === 0 && !error ? (
          <p className="widget-empty">{CHECKLIST_WIDGET_COPY.LOG_EMPTY}</p>
        ) : null}
        {groups.map(([businessDate, groupedEvents]) => (
          <section className="checklist-log-group" key={businessDate}>
            <h4>{businessDate}</h4>
            <ol>
              {groupedEvents.map((event) => (
                <li key={event.id}>
                  <time dateTime={event.occurredAt}>
                    {LOG_TIME_FORMATTER.format(new Date(event.occurredAt))}
                  </time>
                  <span>{eventLabel(event)}</span>
                  <small>{CHECKLIST_EVENT_LABEL_BY_ACTION[event.action]}</small>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {error ? <p className="widget-error" role="alert">{error}</p> : null}
      </XpWindowFrame>
    </div>
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
