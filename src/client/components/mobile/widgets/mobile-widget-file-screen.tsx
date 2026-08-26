import { useCallback, useEffect, useState } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { ChecklistItem, DashboardWidget } from "@/types/widgets/widget";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MobileChecklist } from "@client/components/mobile/widgets/mobile-checklist";
import { MobileChecklistLogs } from "@client/components/mobile/widgets/mobile-checklist-logs";
import { MobileMemo } from "@client/components/mobile/widgets/mobile-memo";
import { MOBILE_CLASS_NAME, MOBILE_COPY } from "@client/constants/shared/mobile";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";

interface MobileWidgetFileScreenProps {
  readonly entryId: string;
  readonly title: string;
  readonly dashboard: DashboardGateway;
  readonly widgetFiles: WidgetFileGateway;
  readonly onDirtyChange: (dirty: boolean) => void;
}

export function MobileWidgetFileScreen({
  entryId,
  title,
  dashboard,
  widgetFiles,
  onDirtyChange,
}: MobileWidgetFileScreenProps) {
  const [widget, setWidget] = useState<DashboardWidget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setWidget((await widgetFiles.getWidgetFile(entryId)).widget);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught, MOBILE_COPY.LOAD_FAILED));
    } finally {
      setLoading(false);
    }
  }, [entryId, widgetFiles]);
  useEffect(() => void load(), [load]);

  const replaceItem = (item: ChecklistItem): void => {
    setWidget((current) =>
      current?.type === WIDGET_TYPE.DAILY_CHECKLIST
        ? {
            ...current,
            data: {
              ...current.data,
              items: current.data.items.map((candidate) => candidate.id === item.id ? item : candidate),
            },
          }
        : current,
    );
  };

  return (
    <MobileActivity title={widget?.file?.name ?? title}>
      {loading && !widget ? <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.LOADING}</p> : null}
      {error ? (
        <div className={MOBILE_CLASS_NAME.ERROR} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>{MOBILE_COPY.RETRY}</button>
        </div>
      ) : null}
      {widget?.type === WIDGET_TYPE.MEMO ? (
        <MobileMemo
          markdown={widget.data.markdown}
          onDirtyChange={onDirtyChange}
          onSave={async (markdown) => {
            const data = await dashboard.updateMemo(widget.id, markdown);
            setWidget({ ...widget, data });
          }}
        />
      ) : null}
      {widget?.type === WIDGET_TYPE.DAILY_CHECKLIST ? (
        <MobileChecklist
          items={widget.data.items}
          onAdd={async (label) => {
            const item = await dashboard.addChecklistItem(widget.id, label);
            setWidget({ ...widget, data: { ...widget.data, items: [...widget.data.items, item] } });
          }}
          onRename={async (item, label) => replaceItem(await dashboard.updateChecklistItem(widget.id, item.id, label))}
          onDelete={async (item) => {
            await dashboard.deleteChecklistItem(widget.id, item.id);
            setWidget({ ...widget, data: { ...widget.data, items: widget.data.items.filter((candidate) => candidate.id !== item.id) } });
          }}
          onToggle={async (item, checked) => replaceItem(await dashboard.setChecklistItemChecked(widget.id, item.id, checked))}
          onShowLogs={() => setShowLogs(true)}
        />
      ) : null}
      {showLogs && widget?.type === WIDGET_TYPE.DAILY_CHECKLIST ? (
        <MobileChecklistLogs widgetId={widget.id} gateway={dashboard} onClose={() => setShowLogs(false)} />
      ) : null}
    </MobileActivity>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
