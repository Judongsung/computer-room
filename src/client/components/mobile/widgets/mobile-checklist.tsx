import type { ChecklistRepeatCycle } from "@/constants/widgets/checklist-repeat";
import { CHECKLIST_REPEAT_COPY } from "@client/content/ko/widgets/checklist-repeat";
import { formatKoreaDateTime } from "@client/utils/format-date-time";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useState } from "react";
import { MAX_ACTIVE_CHECKLIST_ITEMS } from "@/constants/widgets/checklist";
import type { ChecklistItem } from "@/types/widgets/widget";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { CHECKLIST_WIDGET_COPY } from "@client/content/ko/widgets/content";
import { messageFromError } from "@client/errors/error-message";

interface MobileChecklistProps {
  readonly repeatCycle?: ChecklistRepeatCycle;
  readonly items: readonly ChecklistItem[];
  readonly onAdd: (label: string) => Promise<void>;
  readonly onRename: (item: ChecklistItem, label: string) => Promise<void>;
  readonly onDelete: (item: ChecklistItem) => Promise<void>;
  readonly onToggle: (item: ChecklistItem, checked: boolean) => Promise<void>;
  readonly onShowLogs?: () => void;
  readonly onRequestFileSave?: () => void;
}

export function MobileChecklist({
  items,
  repeatCycle = "daily",
  onAdd,
  onRename,
  onDelete,
  onToggle,
  onShowLogs,
  onRequestFileSave,
}: MobileChecklistProps) {
  const [editing, setEditing] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (operation: () => Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (caught) {
      setError(messageFromError(caught, CHECKLIST_WIDGET_COPY.CHANGE_FAILED));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={MOBILE_CLASS_NAME.WIDGET}>
      <p>{CHECKLIST_REPEAT_COPY.LABELS[repeatCycle]}</p>
      <div className={MOBILE_CLASS_NAME.TOOLBAR}>
        {onShowLogs ? <button type="button" onClick={onShowLogs}>{MOBILE_COPY.HISTORY}</button> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setEditing((current) => !current);
            setEditingId(null);
            setNewLabel("");
          }}
        >
          {editing ? MOBILE_COPY.DONE : MOBILE_COPY.EDIT}
        </button>
        {onRequestFileSave ? (
          <button type="button" onClick={onRequestFileSave}>{MOBILE_COPY.SAVE_AS_FILE}</button>
        ) : null}
      </div>
      {items.length === 0 ? <p>{CHECKLIST_WIDGET_COPY.EMPTY_CONTENT}</p> : null}
      {items.length ? (
        <ul className={MOBILE_CLASS_NAME.WIDGET_CHECKLIST}>
          {items.map((item) => (
            <li key={item.id}>
              {editingId === item.id ? (
                <form
                  className={MOBILE_CLASS_NAME.FORM}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await onRename(item, editingLabel);
                      setEditingId(null);
                    });
                  }}
                >
                  <input
                    value={editingLabel}
                    disabled={busy}
                    aria-label={MOBILE_COPY.EDIT_ITEM}
                    onChange={(event) => setEditingLabel(event.currentTarget.value)}
                  />
                  <div className={MOBILE_CLASS_NAME.BUTTON_ROW}>
                    <button type="submit" disabled={busy}>{MOBILE_COPY.SAVE_LOCAL}</button>
                    <button type="button" disabled={busy} onClick={() => setEditingId(null)}>
                      {MOBILE_COPY.CANCEL}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      disabled={busy}
                      onChange={(event) =>
                        void run(() => onToggle(item, event.currentTarget.checked))
                      }
                    />
                    {item.checked ? <del>{item.label}</del> : <span>{item.label}</span>}
                  </label>
                  {item.checked && item.checkedAt ? <time className="checklist-checked-at" dateTime={item.checkedAt}>{formatKoreaDateTime(item.checkedAt)}</time> : null}
                  {editing ? (
                    <div className={MOBILE_CLASS_NAME.BUTTON_ROW}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(item.id);
                          setEditingLabel(item.label);
                        }}
                      >
                        {MOBILE_COPY.EDIT_ITEM}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(CHECKLIST_WIDGET_COPY.DELETE_ITEM_CONFIRM)) {
                            void run(() => onDelete(item));
                          }
                        }}
                      >
                        {MOBILE_COPY.DELETE_ITEM}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {editing ? (
        <form
          className={MOBILE_CLASS_NAME.FORM}
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await onAdd(newLabel);
              setNewLabel("");
            });
          }}
        >
          <label className={MOBILE_CLASS_NAME.FIELD}>
            {MOBILE_COPY.NEW_ITEM_PLACEHOLDER}
            <input
              value={newLabel}
              disabled={busy || items.length >= MAX_ACTIVE_CHECKLIST_ITEMS}
              onChange={(event) => setNewLabel(event.currentTarget.value)}
            />
          </label>
          <button type="submit" disabled={busy || items.length >= MAX_ACTIVE_CHECKLIST_ITEMS}>
            {MOBILE_COPY.ADD_ITEM}
          </button>
        </form>
      ) : null}
      {error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{error}</p> : null}
    </div>
  );
}
