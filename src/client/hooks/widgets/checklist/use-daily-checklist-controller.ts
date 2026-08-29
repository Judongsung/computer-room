import { useCallback, useRef, useState } from "react";
import { MAX_ACTIVE_CHECKLIST_ITEMS } from "@/constants/widgets/checklist";
import type {
  ChecklistItem,
  DailyChecklistData,
  DailyChecklistWidget,
} from "@/types/widgets/widget";
import { CHECKLIST_WIDGET_COPY } from "@client/content/ko/widgets/content";
import {
  removeChecklistItem,
  replaceChecklistItem,
} from "@client/domain/widgets/checklist-items";
import { messageFromError } from "@client/errors/error-message";
import { useChecklistRefresh } from "@client/hooks/widgets/checklist/use-checklist-refresh";
import type { DailyChecklistController } from "@client/types/widgets/daily-checklist";
import type { ChecklistGateway } from "@client/types/widgets/ports/checklist";

interface DailyChecklistControllerOptions {
  readonly widget: DailyChecklistWidget;
  readonly gateway: ChecklistGateway;
  readonly onWidgetChange: (widget: DailyChecklistWidget) => void;
}

export function useDailyChecklistController({
  widget,
  gateway,
  onWidgetChange,
}: DailyChecklistControllerOptions): DailyChecklistController {
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutationInFlight = useRef(false);

  const publish = useCallback(
    (data: DailyChecklistData): void => {
      onWidgetChange({ ...widget, data });
    },
    [onWidgetChange, widget],
  );

  const refresh = useCallback(async (): Promise<void> => {
    try {
      publish(await gateway.getChecklist(widget.id));
      setError(null);
    } catch (loadError) {
      setError(messageFromError(loadError, CHECKLIST_WIDGET_COPY.LOAD_FAILED));
    }
  }, [gateway, publish, widget.id]);

  useChecklistRefresh({ nextResetAt: widget.data.nextResetAt, refresh });

  const beginMutation = useCallback((): boolean => {
    if (mutationInFlight.current) {
      return false;
    }
    mutationInFlight.current = true;
    setIsMutating(true);
    setError(null);
    return true;
  }, []);

  const finishMutation = useCallback((): void => {
    mutationInFlight.current = false;
    setIsMutating(false);
  }, []);

  const addItem = useCallback(async (): Promise<void> => {
    if (!isEditingItems || !beginMutation()) {
      return;
    }
    try {
      const item = await gateway.addChecklistItem(widget.id, newLabel);
      publish({ ...widget.data, items: [...widget.data.items, item] });
      setNewLabel("");
    } catch (mutationError) {
      setError(
        messageFromError(mutationError, CHECKLIST_WIDGET_COPY.CHANGE_FAILED),
      );
    } finally {
      finishMutation();
    }
  }, [
    beginMutation,
    finishMutation,
    gateway,
    isEditingItems,
    newLabel,
    publish,
    widget,
  ]);

  const updateItem = useCallback(
    async (item: ChecklistItem): Promise<void> => {
      if (!isEditingItems || !beginMutation()) {
        return;
      }
      try {
        const updated = await gateway.updateChecklistItem(
          widget.id,
          item.id,
          editingLabel,
        );
        publish({
          ...widget.data,
          items: replaceChecklistItem(widget.data.items, updated),
        });
        setEditingItemId(null);
        setEditingLabel("");
      } catch (mutationError) {
        setError(
          messageFromError(mutationError, CHECKLIST_WIDGET_COPY.CHANGE_FAILED),
        );
      } finally {
        finishMutation();
      }
    },
    [
      beginMutation,
      editingLabel,
      finishMutation,
      gateway,
      isEditingItems,
      publish,
      widget,
    ],
  );

  const deleteItem = useCallback(
    async (item: ChecklistItem): Promise<void> => {
      if (
        !isEditingItems ||
        mutationInFlight.current ||
        !window.confirm(CHECKLIST_WIDGET_COPY.DELETE_ITEM_CONFIRM) ||
        !beginMutation()
      ) {
        return;
      }
      try {
        await gateway.deleteChecklistItem(widget.id, item.id);
        publish({
          ...widget.data,
          items: removeChecklistItem(widget.data.items, item.id),
        });
      } catch (mutationError) {
        setError(
          messageFromError(mutationError, CHECKLIST_WIDGET_COPY.CHANGE_FAILED),
        );
      } finally {
        finishMutation();
      }
    },
    [
      beginMutation,
      finishMutation,
      gateway,
      isEditingItems,
      publish,
      widget,
    ],
  );

  const toggleItem = useCallback(
    async (item: ChecklistItem, checked: boolean): Promise<void> => {
      if (!beginMutation()) {
        return;
      }
      const previous = widget.data;
      const optimistic = {
        ...previous,
        items: replaceChecklistItem(previous.items, { ...item, checked }),
      };
      publish(optimistic);
      try {
        const updated = await gateway.setChecklistItemChecked(
          widget.id,
          item.id,
          checked,
        );
        publish({
          ...optimistic,
          items: replaceChecklistItem(optimistic.items, updated),
        });
      } catch (mutationError) {
        publish(previous);
        setError(
          messageFromError(mutationError, CHECKLIST_WIDGET_COPY.CHANGE_FAILED),
        );
      } finally {
        finishMutation();
      }
    },
    [beginMutation, finishMutation, gateway, publish, widget],
  );

  const toggleEditing = useCallback((): void => {
    if (mutationInFlight.current) {
      return;
    }
    if (isEditingItems) {
      setNewLabel("");
      setEditingItemId(null);
      setEditingLabel("");
    } else {
      setError(null);
    }
    setIsEditingItems((current) => !current);
  }, [isEditingItems]);

  const beginEditingItem = useCallback((item: ChecklistItem): void => {
    setEditingItemId(item.id);
    setEditingLabel(item.label);
  }, []);

  const cancelEditingItem = useCallback((): void => {
    setEditingItemId(null);
  }, []);

  return {
    isEditingItems,
    newLabel,
    editingItemId,
    editingLabel,
    isMutating,
    showLogs,
    error,
    canAddItem:
      !isMutating && widget.data.items.length < MAX_ACTIVE_CHECKLIST_ITEMS,
    setNewLabel,
    setEditingLabel,
    toggleEditing,
    beginEditingItem,
    cancelEditingItem,
    addItem,
    updateItem,
    deleteItem,
    toggleItem,
    openLogs: () => setShowLogs(true),
    closeLogs: () => setShowLogs(false),
  };
}
