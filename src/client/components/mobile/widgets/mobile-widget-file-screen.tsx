import { useChecklistRefresh } from "@client/hooks/widgets/checklist/use-checklist-refresh";
import { useWidgetRequestCoordinator } from "@client/hooks/widgets/use-widget-request-coordinator";
import { CHECKLIST_WIDGET_COPY, MEMO_WIDGET_COPY } from "@client/content/ko/widgets/content";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { ChecklistItem, DashboardWidget } from "@/types/widgets/widget";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MobileChecklist } from "@client/components/mobile/widgets/mobile-checklist";
import { MobileChecklistLogs } from "@client/components/mobile/widgets/mobile-checklist-logs";
import { MobileMemo } from "@client/components/mobile/widgets/mobile-memo";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import {
  removeChecklistItem,
  replaceChecklistItem,
} from "@client/domain/widgets/checklist-items";
import { messageFromError } from "@client/errors/error-message";
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
  const scope = useMemo(() => ({}), [entryId, dashboard, widgetFiles]);
  const [stored, setStored] = useState<{ scope: object; widget: DashboardWidget } | null>(null);
  const widget = stored?.scope === scope ? stored.widget : null;
  const [showLogs, setShowLogs] = useState(false);
  const requests = useWidgetRequestCoordinator({
    scope,
    read: () => widgetFiles.getWidgetFile(entryId),
    onRead: (document) => setStored({ scope, widget: document.widget }),
  });
  useEffect(() => { void requests.refresh(); setShowLogs(false); }, [requests.refresh]);
  useChecklistRefresh({ nextResetAt: widget?.type === WIDGET_TYPE.DAILY_CHECKLIST ? widget.data.nextResetAt : "", refresh: requests.refresh });

  const updateWidget = useCallback((id: string, update: (current: DashboardWidget) => DashboardWidget) => {
    setStored((current) => current?.scope === scope && current.widget.id === id
      ? { scope, widget: update(current.widget) } : current);
  }, [scope]);
  const replaceItem = (id: string, item: ChecklistItem): void => {
    updateWidget(id, (current) => current.type === WIDGET_TYPE.DAILY_CHECKLIST
      ? { ...current, data: { ...current.data, items: replaceChecklistItem(current.data.items, item) } }
      : current);
  };
  const error = requests.readError
    ? messageFromError(requests.readError.cause, MOBILE_COPY.LOAD_FAILED) : null;
  const mutationError = requests.mutationError
    ? messageFromError(requests.mutationError.cause, widget?.type === WIDGET_TYPE.MEMO
      ? MEMO_WIDGET_COPY.SAVE_FAILED : CHECKLIST_WIDGET_COPY.CHANGE_FAILED) : null;

  return (
    <MobileActivity title={widget?.file?.name ?? title}>
      {!widget && !error ? <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.LOADING}</p> : null}
      {error ? (
        <div className={MOBILE_CLASS_NAME.ERROR} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void requests.refresh()}>{MOBILE_COPY.RETRY}</button>
        </div>
      ) : null}
      {mutationError ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{mutationError}</p> : null}
      {widget?.type === WIDGET_TYPE.MEMO ? (
        <MobileMemo
          markdown={widget.data.markdown}
          onDirtyChange={onDirtyChange}
          onSave={(markdown) => requests.mutate({
            operation: () => dashboard.updateMemo(widget.id, markdown),
            onSuccess: (data) => updateWidget(widget.id, (current) => current.type === WIDGET_TYPE.MEMO ? { ...current, data } : current),
          })}
        />
      ) : null}
      {widget?.type === WIDGET_TYPE.DAILY_CHECKLIST ? (
        <MobileChecklist
          repeatCycle={widget.data.repeatCycle ?? "daily"}
          items={widget.data.items}
          onAdd={(label) => requests.mutate({
            operation: () => dashboard.addChecklistItem(widget.id, label),
            onSuccess: (item) => updateWidget(widget.id, (current) => current.type === WIDGET_TYPE.DAILY_CHECKLIST
              ? { ...current, data: { ...current.data, items: [...current.data.items, item] } } : current),
          })}
          onRename={(item, label) => requests.mutate({
            operation: () => dashboard.updateChecklistItem(widget.id, item.id, label),
            onSuccess: (updated) => replaceItem(widget.id, updated),
          })}
          onDelete={(item) => requests.mutate({
            operation: () => dashboard.deleteChecklistItem(widget.id, item.id),
            onSuccess: () => updateWidget(widget.id, (current) => current.type === WIDGET_TYPE.DAILY_CHECKLIST
              ? { ...current, data: { ...current.data, items: removeChecklistItem(current.data.items, item.id) } } : current),
          })}
          onToggle={(item, checked) => requests.mutate({
            operation: () => dashboard.setChecklistItemChecked(widget.id, item.id, checked),
            onSuccess: (updated) => replaceItem(widget.id, updated),
          })}
          onShowLogs={() => setShowLogs(true)}
        />
      ) : null}
      {showLogs && widget?.type === WIDGET_TYPE.DAILY_CHECKLIST ? (
        <MobileChecklistLogs widgetId={widget.id} gateway={dashboard} onClose={() => setShowLogs(false)} />
      ) : null}
    </MobileActivity>
  );
}
