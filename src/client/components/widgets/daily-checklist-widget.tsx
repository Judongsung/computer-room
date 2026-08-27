import { useCallback, useEffect, useState } from "react";
import { MAX_ACTIVE_CHECKLIST_ITEMS } from "@/constants/widgets/checklist";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type {
  ChecklistItem,
  DailyChecklistData,
  DailyChecklistWidget as DailyChecklistWidgetData,
} from "@/types/widgets/widget";
import {
  CHECKLIST_RESET_BUFFER_MILLISECONDS,
  MAX_BROWSER_TIMER_DELAY_MILLISECONDS,
} from "@client/constants/widgets/checklist";
import { CHECKLIST_WIDGET_COPY } from "@client/constants/widgets/content";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import { XP_WIDGET_TOOLBAR_ACTION } from "@client/constants/shared/xp";
import { XpWidgetToolbarButton } from "@client/components/shared/xp-widget-toolbar-button";
import { ChecklistLogDialog } from "@client/components/widgets/checklist-log-dialog";
import { WidgetCard } from "@client/components/widgets/widget-card";
import type { WidgetComponentProps } from "@client/types/desktop/desktop";

export function DailyChecklistWidget(props: WidgetComponentProps) {
  if (props.widget.type !== WIDGET_TYPE.DAILY_CHECKLIST) {
    return null;
  }
  return <DailyChecklistContent {...props} widget={props.widget} />;
}

type DailyChecklistContentProps = Omit<WidgetComponentProps, "widget"> & {
  readonly widget: DailyChecklistWidgetData;
};

function DailyChecklistContent({
  widget,
  windowControls,
  gateway,
  onWidgetChange,
}: DailyChecklistContentProps) {
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEditItems = isEditingItems;

  const publish = useCallback(
    (data: DailyChecklistData): void => {
      onWidgetChange({ ...widget, data });
    },
    [onWidgetChange, widget],
  );

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const data = await gateway.getChecklist(widget.id);
      publish(data);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError, CHECKLIST_WIDGET_COPY.LOAD_FAILED));
    }
  }, [gateway, publish, widget.id]);

  useEffect(() => {
    const resetAt = Date.parse(widget.data.nextResetAt);
    if (!Number.isFinite(resetAt)) {
      return undefined;
    }
    const delay = Math.min(
      Math.max(
        resetAt - Date.now() + CHECKLIST_RESET_BUFFER_MILLISECONDS,
        CHECKLIST_RESET_BUFFER_MILLISECONDS,
      ),
      MAX_BROWSER_TIMER_DELAY_MILLISECONDS,
    );
    const timeout = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(timeout);
  }, [refresh, widget.data.nextResetAt]);

  useEffect(() => {
    const refreshWhenVisible = (): void => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [refresh]);

  const addItem = async (): Promise<void> => {
    if (!canEditItems || isMutating) {
      return;
    }
    setIsMutating(true);
    setError(null);
    try {
      const item = await gateway.addChecklistItem(widget.id, newLabel);
      publish({ ...widget.data, items: [...widget.data.items, item] });
      setNewLabel("");
    } catch (mutationError) {
      setError(errorMessage(mutationError, CHECKLIST_WIDGET_COPY.CHANGE_FAILED));
    } finally {
      setIsMutating(false);
    }
  };

  const updateItem = async (item: ChecklistItem): Promise<void> => {
    if (!canEditItems || isMutating) {
      return;
    }
    setIsMutating(true);
    setError(null);
    try {
      const updated = await gateway.updateChecklistItem(
        widget.id,
        item.id,
        editingLabel,
      );
      publish(replaceChecklistItem(widget.data, updated));
      setEditingItemId(null);
      setEditingLabel("");
    } catch (mutationError) {
      setError(errorMessage(mutationError, CHECKLIST_WIDGET_COPY.CHANGE_FAILED));
    } finally {
      setIsMutating(false);
    }
  };

  const deleteItem = async (item: ChecklistItem): Promise<void> => {
    if (
      !canEditItems ||
      isMutating ||
      !window.confirm(CHECKLIST_WIDGET_COPY.DELETE_ITEM_CONFIRM)
    ) {
      return;
    }
    setIsMutating(true);
    setError(null);
    try {
      await gateway.deleteChecklistItem(widget.id, item.id);
      publish({
        ...widget.data,
        items: widget.data.items.filter((candidate) => candidate.id !== item.id),
      });
    } catch (mutationError) {
      setError(errorMessage(mutationError, CHECKLIST_WIDGET_COPY.CHANGE_FAILED));
    } finally {
      setIsMutating(false);
    }
  };

  const toggleItem = async (
    item: ChecklistItem,
    checked: boolean,
  ): Promise<void> => {
    if (isMutating) {
      return;
    }
    const previous = widget.data;
    const optimistic = replaceChecklistItem(previous, { ...item, checked });
    publish(optimistic);
    setIsMutating(true);
    setError(null);
    try {
      const updated = await gateway.setChecklistItemChecked(
        widget.id,
        item.id,
        checked,
      );
      publish(replaceChecklistItem(optimistic, updated));
    } catch (mutationError) {
      publish(previous);
      setError(errorMessage(mutationError, CHECKLIST_WIDGET_COPY.CHANGE_FAILED));
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <>
      <WidgetCard
        title={widget.file?.name ?? CHECKLIST_WIDGET_COPY.UNSAVED_TITLE}
        iconPath={WIDGET_ICON_PATH_BY_TYPE[WIDGET_TYPE.DAILY_CHECKLIST]}
        windowControls={windowControls}
        toolbarActions={
          <>
            <XpWidgetToolbarButton
              action={XP_WIDGET_TOOLBAR_ACTION.HISTORY}
              label={CHECKLIST_WIDGET_COPY.DETAILS}
              onClick={() => setShowLogs(true)}
            />
            <XpWidgetToolbarButton
              action={
                isEditingItems
                  ? XP_WIDGET_TOOLBAR_ACTION.COMPLETE
                  : XP_WIDGET_TOOLBAR_ACTION.EDIT
              }
              label={
                isEditingItems
                  ? CHECKLIST_WIDGET_COPY.FINISH_EDITING
                  : CHECKLIST_WIDGET_COPY.EDIT
              }
              onClick={() => {
                if (isEditingItems) {
                  setNewLabel("");
                  setEditingItemId(null);
                  setEditingLabel("");
                } else {
                  setError(null);
                }
                setIsEditingItems((current) => !current);
              }}
              disabled={isMutating}
            />
          </>
        }
      >
        <div className="checklist-widget">
          {widget.data.items.length === 0 ? (
            <p className="widget-empty">{CHECKLIST_WIDGET_COPY.EMPTY_CONTENT}</p>
          ) : (
            <ul className="checklist-items">
              {widget.data.items.map((item) => (
                <li key={item.id}>
                  {canEditItems && editingItemId === item.id ? (
                    <form
                      className="checklist-item-editor"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void updateItem(item);
                      }}
                    >
                      <input
                        type="text"
                        value={editingLabel}
                        onChange={(event) =>
                          setEditingLabel(event.currentTarget.value)
                        }
                        disabled={isMutating}
                        aria-label={CHECKLIST_WIDGET_COPY.EDIT_ITEM}
                      />
                      <button
                        type="submit"
                        disabled={isMutating}
                      >
                        {CHECKLIST_WIDGET_COPY.SAVE_ITEM}
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setEditingItemId(null)}
                        disabled={isMutating}
                      >
                        {CHECKLIST_WIDGET_COPY.CANCEL_ITEM}
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="checklist-item-label">
                        <input
                          id={checklistItemInputId(item.id)}
                          type="checkbox"
                          checked={item.checked}
                          disabled={isMutating}
                          onChange={(event) =>
                            void toggleItem(item, event.currentTarget.checked)
                          }
                        />
                        <label htmlFor={checklistItemInputId(item.id)}>
                          {item.checked ? (
                            <del>{item.label}</del>
                          ) : (
                            <span>{item.label}</span>
                          )}
                        </label>
                      </div>
                      {canEditItems ? (
                        <div className="checklist-item-actions">
                          <button
                            className="widget-card__action"
                            type="button"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditingLabel(item.label);
                            }}
                            disabled={isMutating}
                          >
                            {CHECKLIST_WIDGET_COPY.EDIT_ITEM}
                          </button>
                          <button
                            className="widget-card__action"
                            type="button"
                            onClick={() => void deleteItem(item)}
                            disabled={isMutating}
                          >
                            {CHECKLIST_WIDGET_COPY.DELETE_ITEM}
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEditItems ? (
            <form
              className="checklist-add-form"
              onSubmit={(event) => {
                event.preventDefault();
                void addItem();
              }}
            >
              <input
                type="text"
                value={newLabel}
                onChange={(event) => setNewLabel(event.currentTarget.value)}
                placeholder={CHECKLIST_WIDGET_COPY.NEW_ITEM_PLACEHOLDER}
                aria-label={CHECKLIST_WIDGET_COPY.NEW_ITEM_PLACEHOLDER}
                disabled={
                  isMutating ||
                  widget.data.items.length >= MAX_ACTIVE_CHECKLIST_ITEMS
                }
              />
              <button
                type="submit"
                disabled={
                  isMutating ||
                  widget.data.items.length >= MAX_ACTIVE_CHECKLIST_ITEMS
                }
              >
                {CHECKLIST_WIDGET_COPY.ADD_ITEM}
              </button>
            </form>
          ) : null}
          {error ? <p className="widget-error" role="alert">{error}</p> : null}
        </div>
      </WidgetCard>

      {showLogs ? (
        <ChecklistLogDialog
          widgetId={widget.id}
          gateway={gateway}
          onClose={() => setShowLogs(false)}
        />
      ) : null}
    </>
  );
}

function checklistItemInputId(itemId: string): string {
  return `checklist-item-${itemId}`;
}

function replaceChecklistItem(
  data: DailyChecklistData,
  replacement: ChecklistItem,
): DailyChecklistData {
  return {
    ...data,
    items: data.items.map((item) =>
      item.id === replacement.id ? replacement : item,
    ),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
