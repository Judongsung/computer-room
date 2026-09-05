import { XpCheckbox } from "@client/components/shared/xp-checkbox";
import { PROGRAM_DOCUMENT_COPY as COPY } from "@client/content/ko/desktop/program-documents";
import type { ChecklistItem, DailyChecklistData } from "@/types/widgets/widget";
import {
  CHECKLIST_CLASS_NAME,
  CHECKLIST_ELEMENT_ID_PREFIX,
} from "@client/constants/widgets/checklist";
import { CHECKLIST_WIDGET_COPY } from "@client/content/ko/widgets/content";
import type { DailyChecklistController } from "@client/types/widgets/daily-checklist";

interface DailyChecklistContentProps {
  readonly data: DailyChecklistData;
  readonly controller: DailyChecklistController;
}

export function DailyChecklistContent({
  data,
  controller,
}: DailyChecklistContentProps) {
  return (
    <div className={CHECKLIST_CLASS_NAME.ROOT}>
      <header className="desktop-checklist-heading"><strong>{COPY.TODAY}</strong><time dateTime={data.businessDate}>{data.businessDate}</time></header>
      {data.items.length === 0 ? (
        <p className={CHECKLIST_CLASS_NAME.EMPTY}>
          {CHECKLIST_WIDGET_COPY.EMPTY_CONTENT}
        </p>
      ) : (
        <ul className={CHECKLIST_CLASS_NAME.ITEMS}>
          {data.items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              controller={controller}
            />
          ))}
        </ul>
      )}

      {controller.isEditingItems ? (
        <form
          className={CHECKLIST_CLASS_NAME.ADD_FORM}
          onSubmit={(event) => {
            event.preventDefault();
            void controller.addItem();
          }}
        >
          <input
            type="text"
            value={controller.newLabel}
            onChange={(event) =>
              controller.setNewLabel(event.currentTarget.value)
            }
            placeholder={CHECKLIST_WIDGET_COPY.NEW_ITEM_PLACEHOLDER}
            aria-label={CHECKLIST_WIDGET_COPY.NEW_ITEM_PLACEHOLDER}
            disabled={!controller.canAddItem}
          />
          <button type="submit" disabled={!controller.canAddItem}>
            {CHECKLIST_WIDGET_COPY.ADD_ITEM}
          </button>
        </form>
      ) : null}
      {controller.error ? (
        <p className={CHECKLIST_CLASS_NAME.ERROR} role="alert">
          {controller.error}
        </p>
      ) : null}
    </div>
  );
}

interface ChecklistItemRowProps {
  readonly item: ChecklistItem;
  readonly controller: DailyChecklistController;
}

function ChecklistItemRow({ item, controller }: ChecklistItemRowProps) {
  if (controller.isEditingItems && controller.editingItemId === item.id) {
    return (
      <li>
        <form
          className={CHECKLIST_CLASS_NAME.ITEM_EDITOR}
          onSubmit={(event) => {
            event.preventDefault();
            void controller.updateItem(item);
          }}
        >
          <input
            type="text"
            value={controller.editingLabel}
            onChange={(event) =>
              controller.setEditingLabel(event.currentTarget.value)
            }
            disabled={controller.isMutating}
            aria-label={CHECKLIST_WIDGET_COPY.EDIT_ITEM}
          />
          <button type="submit" disabled={controller.isMutating}>
            {CHECKLIST_WIDGET_COPY.SAVE_ITEM}
          </button>
          <button
            className={CHECKLIST_CLASS_NAME.SECONDARY_BUTTON}
            type="button"
            onClick={controller.cancelEditingItem}
            disabled={controller.isMutating}
          >
            {CHECKLIST_WIDGET_COPY.CANCEL_ITEM}
          </button>
        </form>
      </li>
    );
  }

  const inputId = `${CHECKLIST_ELEMENT_ID_PREFIX.ITEM_INPUT}${item.id}`;
  return (
    <li>
      <div className={CHECKLIST_CLASS_NAME.ITEM_LABEL}>
        <XpCheckbox id={inputId} checked={item.checked}
          disabled={controller.isMutating}
          onCheckedChange={(checked) => void controller.toggleItem(item, checked)}
          label={item.checked ? <del>{item.label}</del> : <span>{item.label}</span>} />
      </div>
      {controller.isEditingItems ? (
        <div className={CHECKLIST_CLASS_NAME.ITEM_ACTIONS}>
          <button
            className={CHECKLIST_CLASS_NAME.ACTION}
            type="button"
            onClick={() => controller.beginEditingItem(item)}
            disabled={controller.isMutating}
          >
            {CHECKLIST_WIDGET_COPY.EDIT_ITEM}
          </button>
          <button
            className={CHECKLIST_CLASS_NAME.ACTION}
            type="button"
            onClick={() => void controller.deleteItem(item)}
            disabled={controller.isMutating}
          >
            {CHECKLIST_WIDGET_COPY.DELETE_ITEM}
          </button>
        </div>
      ) : null}
    </li>
  );
}
