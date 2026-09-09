import type { ChecklistRepeatCycle } from "@/constants/widgets/checklist-repeat";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MAX_ACTIVE_CHECKLIST_ITEMS } from "@/constants/widgets/checklist";
import type { ChecklistItem, DailyChecklistData, DailyChecklistWidget } from "@/types/widgets/widget";
import { CHECKLIST_WIDGET_COPY } from "@client/content/ko/widgets/content";
import { removeChecklistItem, replaceChecklistItem } from "@client/domain/widgets/checklist-items";
import { messageFromError } from "@client/errors/error-message";
import { useChecklistRefresh } from "@client/hooks/widgets/checklist/use-checklist-refresh";
import { useWidgetRequestCoordinator } from "@client/hooks/widgets/use-widget-request-coordinator";
import type { DailyChecklistController } from "@client/types/widgets/daily-checklist";
import type { ChecklistGateway } from "@client/types/widgets/ports/checklist";

interface DailyChecklistControllerOptions {
  readonly widget: DailyChecklistWidget;
  readonly gateway: ChecklistGateway;
  readonly onWidgetChange: (widget: DailyChecklistWidget) => void;
}

export function useDailyChecklistController({
  widget, gateway, onWidgetChange,
}: DailyChecklistControllerOptions): DailyChecklistController {
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const latest = useRef({ widget, onWidgetChange });
  useLayoutEffect(() => { latest.current = { widget, onWidgetChange }; });
  const scope = useMemo(() => ({ widgetId: widget.id, gateway }), [widget.id, gateway]);
  const publish = useCallback((update: (data: DailyChecklistData) => DailyChecklistData): void => {
    const current = latest.current;
    const next = { ...current.widget, data: update(current.widget.data) };
    latest.current = { ...current, widget: next };
    current.onWidgetChange(next);
  }, []);
  const requests = useWidgetRequestCoordinator({
    scope,
    read: () => gateway.getChecklist(widget.id),
    onRead: (data) => publish(() => data),
  });
  const { mutate, isMutating, clearMutationError } = requests;
  useChecklistRefresh({ nextResetAt: widget.data.nextResetAt, refresh: requests.refresh });

  const changeRepeatCycle = (cycle: ChecklistRepeatCycle): Promise<boolean> => mutate({
    operation: () => gateway.changeChecklistRepeatCycle(widget.id, cycle),
    onSuccess: (data) => publish(() => data),
  });

  const addItem = async (): Promise<void> => {
    if (!isEditingItems) return;
    await mutate({
      operation: () => gateway.addChecklistItem(widget.id, newLabel),
      onSuccess: (item) => {
        publish((data) => ({ ...data, items: [...data.items, item] }));
        setNewLabel("");
      },
    });
  };

  const updateItem = async (item: ChecklistItem): Promise<void> => {
    if (!isEditingItems) return;
    await mutate({
      operation: () => gateway.updateChecklistItem(widget.id, item.id, editingLabel),
      onSuccess: (updated) => {
        publish((data) => ({ ...data, items: replaceChecklistItem(data.items, updated) }));
        setEditingItemId(null);
        setEditingLabel("");
      },
    });
  };

  const deleteItem = async (item: ChecklistItem): Promise<void> => {
    if (!isEditingItems || isMutating() || !window.confirm(CHECKLIST_WIDGET_COPY.DELETE_ITEM_CONFIRM)) return;
    await mutate({
      operation: () => gateway.deleteChecklistItem(widget.id, item.id),
      onSuccess: () => publish((data) => ({ ...data, items: removeChecklistItem(data.items, item.id) })),
    });
  };

  const toggleItem = async (item: ChecklistItem, checked: boolean): Promise<void> => {
    const previous = latest.current.widget.data.items.find((candidate) => candidate.id === item.id);
    if (!previous) return;
    await mutate({
      onStart: () => publish((data) => ({
        ...data, items: replaceChecklistItem(data.items, { ...previous, checked }),
      })),
      operation: () => gateway.setChecklistItemChecked(widget.id, item.id, checked),
      onSuccess: (updated) => publish((data) => ({ ...data, items: replaceChecklistItem(data.items, updated) })),
      onError: () => publish((data) => ({ ...data, items: replaceChecklistItem(data.items, previous) })),
    });
  };

  const toggleEditing = (): void => {
    if (isMutating()) return;
    if (isEditingItems) {
      setNewLabel("");
      setEditingItemId(null);
      setEditingLabel("");
    } else {
      clearMutationError();
    }
    setIsEditingItems((current) => !current);
  };
  const failure = requests.mutationError ?? requests.readError;
  return {
    changeRepeatCycle,
    isEditingItems,
    newLabel,
    editingItemId,
    editingLabel,
    isMutating: requests.mutating,
    showLogs,
    error: failure ? messageFromError(failure.cause, requests.mutationError
      ? CHECKLIST_WIDGET_COPY.CHANGE_FAILED : CHECKLIST_WIDGET_COPY.LOAD_FAILED) : null,
    canAddItem: !requests.mutating && widget.data.items.length < MAX_ACTIVE_CHECKLIST_ITEMS,
    setNewLabel,
    setEditingLabel,
    toggleEditing,
    beginEditingItem: (item) => { setEditingItemId(item.id); setEditingLabel(item.label); },
    cancelEditingItem: () => setEditingItemId(null),
    addItem,
    updateItem,
    deleteItem,
    toggleItem,
    openLogs: () => setShowLogs(true),
    closeLogs: () => setShowLogs(false),
  };
}
